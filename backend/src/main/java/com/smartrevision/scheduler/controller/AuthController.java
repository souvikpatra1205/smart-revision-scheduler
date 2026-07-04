package com.smartrevision.scheduler.controller;

import com.smartrevision.scheduler.api.AuthResponse;
import com.smartrevision.scheduler.api.GoogleLoginRequest;
import com.smartrevision.scheduler.api.LoginRequest;
import com.smartrevision.scheduler.api.OtpRequest;
import com.smartrevision.scheduler.api.PasswordResetRequest;
import com.smartrevision.scheduler.api.RegisterOtpRequest;
import com.smartrevision.scheduler.api.RegisterVerifyRequest;
import com.smartrevision.scheduler.service.AuthService;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register/request-otp")
    public Map<String, String> requestRegistrationOtp(@Valid @RequestBody RegisterOtpRequest request) {
        String testOtp = authService.requestRegistrationOtp(request);
        if (testOtp != null) {
            return Map.of("message", "Registration OTP generated", "testOtp", testOtp);
        }
        return Map.of("message", "Registration OTP sent");
    }

    @PostMapping("/register/verify")
    public AuthResponse completeRegistration(@Valid @RequestBody RegisterVerifyRequest request) {
        return authService.completeRegistration(request);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/google")
    public AuthResponse googleLogin(@Valid @RequestBody GoogleLoginRequest request) {
        return authService.loginWithGoogle(request);
    }

    @PostMapping("/password/request-reset")
    public Map<String, String> requestPasswordReset(@Valid @RequestBody OtpRequest request) {
        String testOtp = authService.requestPasswordResetOtp(request);
        if (testOtp != null) {
            return Map.of("message", "Password reset OTP generated", "testOtp", testOtp);
        }
        return Map.of("message", "Password reset OTP sent");
    }

    @PostMapping("/password/reset")
    public Map<String, String> resetPassword(@Valid @RequestBody PasswordResetRequest request) {
        authService.resetPassword(request);
        return Map.of("message", "Password reset complete");
    }
}
