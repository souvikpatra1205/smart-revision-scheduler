package com.smartrevision.scheduler.service;

import com.smartrevision.scheduler.api.AuthResponse;
import com.smartrevision.scheduler.api.GoogleLoginRequest;
import com.smartrevision.scheduler.api.LoginRequest;
import com.smartrevision.scheduler.api.OtpRequest;
import com.smartrevision.scheduler.api.PasswordResetRequest;
import com.smartrevision.scheduler.api.RegisterOtpRequest;
import com.smartrevision.scheduler.api.RegisterVerifyRequest;
import com.smartrevision.scheduler.auth.AccessToken;
import com.smartrevision.scheduler.auth.AccessTokenRepository;
import com.smartrevision.scheduler.auth.LoginOtp;
import com.smartrevision.scheduler.auth.LoginOtpRepository;
import com.smartrevision.scheduler.auth.OtpPurpose;
import com.smartrevision.scheduler.auth.TokenHasher;
import com.smartrevision.scheduler.user.User;
import com.smartrevision.scheduler.user.UserRepository;
import jakarta.transaction.Transactional;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Collections;
import java.util.Base64;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken;
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier;
import com.google.api.client.http.javanet.NetHttpTransport;
import com.google.api.client.json.gson.GsonFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

@Service
public class AuthService {

    private final LoginOtpRepository loginOtpRepository;
    private final AccessTokenRepository accessTokenRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final TokenHasher tokenHasher;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom secureRandom = new SecureRandom();
    private final long otpExpiryMinutes;
    private final long tokenExpiryDays;
    private final String googleClientId;

    public AuthService(
            LoginOtpRepository loginOtpRepository,
            AccessTokenRepository accessTokenRepository,
            UserRepository userRepository,
            EmailService emailService,
            TokenHasher tokenHasher,
            PasswordEncoder passwordEncoder,
            @Value("${app.auth.otp-expiry-minutes}") long otpExpiryMinutes,
            @Value("${app.auth.token-expiry-days}") long tokenExpiryDays,
            @Value("${app.auth.google-client-id}") String googleClientId
    ) {
        this.loginOtpRepository = loginOtpRepository;
        this.accessTokenRepository = accessTokenRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
        this.tokenHasher = tokenHasher;
        this.passwordEncoder = passwordEncoder;
        this.otpExpiryMinutes = otpExpiryMinutes;
        this.tokenExpiryDays = tokenExpiryDays;
        this.googleClientId = googleClientId;
    }

    @Transactional
    public String requestRegistrationOtp(RegisterOtpRequest request) {
        String email = normalizeEmail(request.email());
        userRepository.findByEmail(email).ifPresent(user -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Account already exists");
        });
        return createAndSendOtp(email, OtpPurpose.REGISTER, "registration");
    }

    @Transactional
    public AuthResponse completeRegistration(RegisterVerifyRequest request) {
        String email = normalizeEmail(request.email());
        userRepository.findByEmail(email).ifPresent(user -> {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Account already exists");
        });
        consumeOtp(email, request.otp(), OtpPurpose.REGISTER);

        User user = new User();
        user.setName(request.name().trim());
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.verifyEmail();
        userRepository.save(user);

        return createSession(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String email = normalizeEmail(request.email());
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (user.getPasswordHash() == null || !passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        return createSession(user);
    }

    @Transactional
    public AuthResponse loginWithGoogle(GoogleLoginRequest request) {
        if (googleClientId == null || googleClientId.isBlank()) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Google login is not configured");
        }

        try {
            GoogleIdTokenVerifier verifier = new GoogleIdTokenVerifier.Builder(
                    new NetHttpTransport(),
                    GsonFactory.getDefaultInstance()
            )
                    .setAudience(Collections.singletonList(googleClientId))
                    .build();

            GoogleIdToken idToken = verifier.verify(request.credential());
            if (idToken == null) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid Google token");
            }

            GoogleIdToken.Payload payload = idToken.getPayload();
            Boolean emailVerified = (Boolean) payload.get("email_verified");
            if (!Boolean.TRUE.equals(emailVerified)) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Google email is not verified");
            }

            String email = normalizeEmail(payload.getEmail());
            String name = (String) payload.get("name");
            User user = userRepository.findByEmail(email).orElseGet(() -> {
                User created = new User();
                created.setEmail(email);
                created.setName(name);
                created.verifyEmail();
                return userRepository.save(created);
            });

            if (!user.isEmailVerified()) {
                user.verifyEmail();
            }
            if ((user.getName() == null || user.getName().isBlank()) && name != null) {
                user.setName(name);
            }

            return createSession(user);
        } catch (ResponseStatusException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Google login failed");
        }
    }

    @Transactional
    public String requestPasswordResetOtp(OtpRequest request) {
        String email = normalizeEmail(request.email());
        userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        return createAndSendOtp(email, OtpPurpose.PASSWORD_RESET, "password reset");
    }

    @Transactional
    public void resetPassword(PasswordResetRequest request) {
        String email = normalizeEmail(request.email());
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Account not found"));
        consumeOtp(email, request.otp(), OtpPurpose.PASSWORD_RESET);
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        user.verifyEmail();
    }

    private String createAndSendOtp(String email, OtpPurpose purpose, String purposeLabel) {
        String otp = String.format("%06d", secureRandom.nextInt(1_000_000));

        LoginOtp loginOtp = new LoginOtp();
        loginOtp.setEmail(email);
        loginOtp.setPurpose(purpose);
        loginOtp.setOtpHash(tokenHasher.sha256(email + ":" + purpose.name() + ":" + otp));
        loginOtp.setExpiresAt(Instant.now().plus(otpExpiryMinutes, ChronoUnit.MINUTES));
        loginOtpRepository.save(loginOtp);

        emailService.sendOtp(email, otp, purposeLabel);
        return emailService.isMailEnabled() ? null : otp;
    }

    private void consumeOtp(String email, String otp, OtpPurpose purpose) {
        LoginOtp loginOtp = loginOtpRepository.findTopByEmailAndPurposeAndUsedFalseOrderByCreatedAtDesc(email, purpose)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid OTP"));

        boolean expired = loginOtp.getExpiresAt().isBefore(Instant.now());
        boolean matches = loginOtp.getOtpHash().equals(tokenHasher.sha256(email + ":" + purpose.name() + ":" + otp.trim()));
        if (expired || !matches) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid OTP");
        }

        loginOtp.markUsed();
    }

    private AuthResponse createSession(User user) {
        String rawToken = issueRawToken();
        AccessToken accessToken = new AccessToken();
        accessToken.setUser(user);
        accessToken.setTokenHash(tokenHasher.sha256(rawToken));
        accessToken.setExpiresAt(Instant.now().plus(tokenExpiryDays, ChronoUnit.DAYS));
        accessTokenRepository.save(accessToken);

        return new AuthResponse(rawToken, user.getId(), user.getEmail());
    }

    private String normalizeEmail(String email) {
        return email.trim().toLowerCase();
    }

    private String issueRawToken() {
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
