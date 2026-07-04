package com.smartrevision.scheduler;

import static org.assertj.core.api.Assertions.assertThat;

import com.smartrevision.scheduler.api.AddTopicRequest;
import com.smartrevision.scheduler.note.NoteFileRepository;
import com.smartrevision.scheduler.service.NoteStorageService;
import com.smartrevision.scheduler.service.TopicService;
import com.smartrevision.scheduler.topic.Difficulty;
import com.smartrevision.scheduler.topic.TopicRepository;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

class SchedulingAlgorithmTest {

    @Test
    void createsExpectedRevisionDates() {
        TopicRepository repository = Mockito.mock(TopicRepository.class, invocation -> invocation.getArgument(0));
        NoteFileRepository noteFileRepository = Mockito.mock(NoteFileRepository.class);
        NoteStorageService noteStorageService = Mockito.mock(NoteStorageService.class);
        TopicService service = new TopicService(repository, noteFileRepository, noteStorageService);

        var response = service.addTopic(1L, new AddTopicRequest(
                "SQL Injection",
                "Cyber Security",
                Difficulty.MEDIUM,
                LocalDate.of(2026, 6, 28),
                null
        ));

        assertThat(response.revisions())
                .extracting("revisionDate")
                .containsExactly(
                        LocalDate.of(2026, 6, 29),
                        LocalDate.of(2026, 7, 1),
                        LocalDate.of(2026, 7, 5),
                        LocalDate.of(2026, 7, 12),
                        LocalDate.of(2026, 7, 28),
                        LocalDate.of(2026, 8, 27),
                        LocalDate.of(2026, 9, 26)
                );
    }
}
