package com.smartrevision.scheduler.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import org.junit.jupiter.api.Test;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

class EmailServiceTest {

    @Test
    void sendOtpReturnsFalseWhenMailDeliveryFails() {
        JavaMailSender mailSender = mock(JavaMailSender.class);
        doThrow(new MailSendException("smtp down")).when(mailSender).send(any(SimpleMailMessage.class));

        EmailService emailService = new EmailService(mailSender, true, "smtp", "sender@example.com", "Smart Revision", "");

        assertFalse(emailService.sendOtp("user@example.com", "123456", "registration"));
    }
}
