package com.sjzm.product.modules.automation.job;

import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Component
public class AutomationJobRegistry {

    private final Map<String, AutomationJob> jobs;

    public AutomationJobRegistry(List<AutomationJob> registeredJobs) {
        Map<String, AutomationJob> indexed = new LinkedHashMap<>();
        for (AutomationJob job : registeredJobs) {
            String code = normalizeCode(job.code());
            AutomationJob previous = indexed.putIfAbsent(code, job);
            if (previous != null) {
                throw new IllegalStateException("Duplicate automation job code: " + code);
            }
        }
        this.jobs = Map.copyOf(indexed);
    }

    public Optional<AutomationJob> find(String code) {
        return Optional.ofNullable(jobs.get(normalizeCode(code)));
    }

    public List<AutomationJobDescriptor> list() {
        return jobs.values().stream()
                .map(job -> new AutomationJobDescriptor(
                        normalizeCode(job.code()), job.name(), job.description()))
                .sorted(Comparator.comparing(AutomationJobDescriptor::code))
                .toList();
    }

    private String normalizeCode(String code) {
        if (code == null || code.isBlank()) {
            throw new IllegalArgumentException("Automation job code must not be blank");
        }
        return code.trim().toUpperCase(Locale.ROOT);
    }
}
