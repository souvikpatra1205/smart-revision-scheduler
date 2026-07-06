package com.smartrevision.scheduler.service;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class NoteStorageService {

    private final String provider;
    private final Path uploadDirectory;
    private final String cloudName;
    private final String apiKey;
    private final String apiSecret;
    private final String folder;
    private final RestTemplate restTemplate = new RestTemplate();

    public NoteStorageService(
            @Value("${app.storage.provider}") String provider,
            @Value("${app.upload.dir:uploads}") String uploadDirectory,
            @Value("${cloudinary.cloud-name:}") String cloudName,
            @Value("${cloudinary.api-key:}") String apiKey,
            @Value("${cloudinary.api-secret:}") String apiSecret,
            @Value("${cloudinary.folder:smart-revision-notes}") String folder
    ) {
        this.provider = provider == null ? "local" : provider.trim().toLowerCase();
        this.uploadDirectory = Path.of(uploadDirectory).toAbsolutePath().normalize();
        this.cloudName = cloudName;
        this.apiKey = apiKey;
        this.apiSecret = apiSecret;
        this.folder = folder;
    }

    public StoredNoteFile store(MultipartFile file, String storedFileName) {
        if ("cloudinary".equals(provider)) {
            return storeInCloudinary(file);
        }
        return storeLocally(file, storedFileName);
    }

    public Resource load(String storageProvider, String storedFileName, String fileUrl) {
        if ("cloudinary".equalsIgnoreCase(storageProvider)) {
            return loadCloudinary(fileUrl);
        }
        return loadLocal(storedFileName);
    }

    private StoredNoteFile storeLocally(MultipartFile file, String storedFileName) {
        try {
            Files.createDirectories(uploadDirectory);
            Path target = uploadDirectory.resolve(storedFileName).normalize();
            if (!target.startsWith(uploadDirectory)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file path");
            }
            file.transferTo(target);
            return new StoredNoteFile("local", storedFileName, null);
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not save file");
        }
    }

    @SuppressWarnings("unchecked")
    private StoredNoteFile storeInCloudinary(MultipartFile file) {
        requireCloudinaryConfig();
        try {
            String resourceType = cloudinaryResourceType(file);
            long timestamp = Instant.now().getEpochSecond();
            Map<String, String> signedParams = new TreeMap<>();
            signedParams.put("folder", folder);
            signedParams.put("timestamp", Long.toString(timestamp));

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new NamedByteArrayResource(file.getBytes(), file.getOriginalFilename()));
            body.add("api_key", apiKey);
            body.add("timestamp", Long.toString(timestamp));
            body.add("folder", folder);
            body.add("signature", signatureFor(signedParams));

            HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body);
            String url = "https://api.cloudinary.com/v1_1/" + urlEncode(cloudName) + "/" + resourceType + "/upload";
            Map<String, Object> response = restTemplate.postForObject(url, request, Map.class);
            if (response == null || response.get("secure_url") == null || response.get("public_id") == null) {
                throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Cloudinary upload failed");
            }
            return new StoredNoteFile(
                    "cloudinary",
                    response.get("public_id").toString(),
                    response.get("secure_url").toString()
            );
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not read upload file");
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Cloudinary upload failed");
        }
    }

    private Resource loadLocal(String storedFileName) {
        Path filePath = uploadDirectory.resolve(storedFileName).normalize();
        if (!filePath.startsWith(uploadDirectory)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid file path");
        }
        try {
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
            }
            return resource;
        } catch (IOException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
        }
    }

    private Resource loadCloudinary(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File URL not found");
        }
        try {
            ResponseEntity<byte[]> response = restTemplate.getForEntity(fileUrl, byte[].class);
            byte[] body = response.getBody();
            if (!response.getStatusCode().is2xxSuccessful() || body == null || body.length == 0) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
            }
            return new ByteArrayResource(body);
        } catch (RestClientException exception) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "File not found");
        }
    }

    private void requireCloudinaryConfig() {
        if (cloudName.isBlank() || apiKey.isBlank() || apiSecret.isBlank()) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Cloudinary is not configured");
        }
    }

    private String signatureFor(Map<String, String> params) {
        StringBuilder payload = new StringBuilder();
        params.forEach((key, value) -> {
            if (!payload.isEmpty()) {
                payload.append('&');
            }
            payload.append(key).append('=').append(value);
        });
        payload.append(apiSecret);
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-1");
            return HexFormat.of().formatHex(digest.digest(payload.toString().getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Could not sign Cloudinary request");
        }
    }

    private String urlEncode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String cloudinaryResourceType(MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType != null && contentType.startsWith("image/")) {
            return "image";
        }
        return "raw";
    }

    public record StoredNoteFile(String storageProvider, String storedFileName, String fileUrl) {
    }

    private static class NamedByteArrayResource extends ByteArrayResource {
        private final String filename;

        NamedByteArrayResource(byte[] byteArray, String filename) {
            super(byteArray);
            this.filename = filename == null || filename.isBlank() ? UUID.randomUUID().toString() : filename;
        }

        @Override
        public String getFilename() {
            return filename;
        }
    }
}
