package com.smartrevision.scheduler.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;
    private final boolean mailEnabled;
    private final String fromAddress;

    public EmailService(
            JavaMailSender mailSender,
            @Value("${app.mail.enabled}") boolean mailEnabled,
            @Value("${app.mail.from}") String fromAddress
    ) {
        this.mailSender = mailSender;
        this.mailEnabled = mailEnabled;
        this.fromAddress = fromAddress;
    }

    public boolean sendOtp(String email, String otp, String purposeLabel) {
        if (!mailEnabled) {
            log.info("Development {} OTP for {} is {}", purposeLabel, email, otp);
            return false;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(email);
            message.setSubject("Your Smart Revision " + purposeLabel + " OTP");
            message.setText("Your OTP is " + otp + ". It expires in 10 minutes.");
            mailSender.send(message);
            return true;
        } catch (MailException exception) {
            log.warn("Failed to send {} OTP to {}", purposeLabel, email, exception);
            return false;
        }
    }

    public boolean isMailEnabled() {
        return mailEnabled;
    }
}
