package com.smartrevision.scheduler.service;

import com.smartrevision.scheduler.api.AddTopicRequest;
import com.smartrevision.scheduler.api.NoteFileResponse;
import com.smartrevision.scheduler.api.TopicResponse;
import com.smartrevision.scheduler.note.NoteFile;
import com.smartrevision.scheduler.note.NoteFileRepository;
import com.smartrevision.scheduler.revision.Revision;
import com.smartrevision.scheduler.topic.Topic;
import com.smartrevision.scheduler.topic.TopicRepository;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TopicService {

    private static final int[] REVISION_DAYS = {1, 3, 7, 14, 30, 60, 90};
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "application/pdf",
            "image/jpeg",
            "image/png",
            "image/webp"
    );

    private final TopicRepository topicRepository;
    private final NoteFileRepository noteFileRepository;
    private final NoteStorageService noteStorageService;

    public TopicService(
            TopicRepository topicRepository,
            NoteFileRepository noteFileRepository,
            NoteStorageService noteStorageService
    ) {
        this.topicRepository = topicRepository;
        this.noteFileRepository = noteFileRepository;
        this.noteStorageService = noteStorageService;
    }

    @Transactional
    public TopicResponse addTopic(Long userId, AddTopicRequest request) {
        Topic topic = new Topic();
        topic.setUserId(userId);
        topic.setTopicName(request.topicName().trim());
        topic.setSubject(request.subject().trim());
        topic.setDifficulty(request.difficulty());
        topic.setDateLearned(request.dateLearned());
        topic.setNotes(cleanNotes(request.notes()));

        for (int i = 0; i < REVISION_DAYS.length; i++) {
            Revision revision = new Revision();
            revision.setRevisionNumber(i + 1);
            revision.setRevisionDay(REVISION_DAYS[i]);
            revision.setRevisionDate(request.dateLearned().plusDays(REVISION_DAYS[i]));
            topic.addRevision(revision);
        }

        return TopicResponse.from(topicRepository.save(topic));
    }

    @Transactional
    public List<NoteFileResponse> addNoteFiles(Long userId, Long topicId, List<MultipartFile> files) {
        Topic topic = topicRepository.findByIdAndUserId(topicId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Topic not found"));
        if (files == null || files.isEmpty()) {
            return List.of();
        }

        return files.stream()
                .filter(file -> file != null && !file.isEmpty())
                .map(file -> saveNoteFile(topic, file))
                .map(NoteFileResponse::from)
                .toList();
    }

    public NoteFileDownload loadNoteFile(Long userId, Long fileId) {
        NoteFile noteFile = noteFileRepository.findByIdAndTopicUserId(fileId, userId)
                .orElseThrow(() -> new EntityNotFoundException("File not found"));
        Resource resource = noteStorageService.load(
                noteFile.getStorageProvider(),
                noteFile.getStoredFileName(),
                noteFile.getFileUrl()
        );
        return new NoteFileDownload(noteFile, resource);
    }

    @Transactional
    public void deleteTopic(Long userId, Long topicId) {
        Topic topic = topicRepository.findByIdAndUserId(topicId, userId)
                .orElseThrow(() -> new EntityNotFoundException("Topic not found"));
        topicRepository.delete(topic);
    }

    private String cleanNotes(String notes) {
        if (notes == null || notes.isBlank()) {
            return null;
        }
        return notes.trim();
    }

    private NoteFile saveNoteFile(Topic topic, MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_CONTENT_TYPES.contains(contentType)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Only PDF, JPG, PNG, and WEBP files are allowed");
        }

        String originalFileName = StringUtils.cleanPath(file.getOriginalFilename() == null ? "notes-file" : file.getOriginalFilename());
        String extension = extensionFrom(originalFileName);
        String storedFileName = UUID.randomUUID() + extension;
        NoteStorageService.StoredNoteFile storedFile = noteStorageService.store(file, storedFileName);

        NoteFile noteFile = new NoteFile();
        noteFile.setOriginalFileName(originalFileName);
        noteFile.setStoredFileName(storedFile.storedFileName());
        noteFile.setStorageProvider(storedFile.storageProvider());
        noteFile.setFileUrl(storedFile.fileUrl());
        noteFile.setContentType(contentType);
        noteFile.setSizeBytes(file.getSize());
        topic.addNoteFile(noteFile);
        return noteFileRepository.save(noteFile);
    }

    private String extensionFrom(String fileName) {
        int dotIndex = fileName.lastIndexOf('.');
        if (dotIndex < 0) {
            return "";
        }
        return fileName.substring(dotIndex);
    }

    public record NoteFileDownload(NoteFile noteFile, Resource resource) {
    }
}
