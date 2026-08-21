package com.sjzm.product.modules.automation.service.impl;

import com.baomidou.mybatisplus.core.toolkit.Wrappers;
import com.sjzm.product.modules.automation.entity.AutomationRecordBinding;
import com.sjzm.product.modules.automation.mapper.AutomationRecordBindingMapper;
import com.sjzm.product.modules.automation.service.AutomationBindingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AutomationBindingServiceImpl implements AutomationBindingService {

    private final AutomationRecordBindingMapper mapper;

    @Override
    public AutomationRecordBinding find(String jobCode, String businessKey,
                                        String targetType, String targetResource) {
        return mapper.selectOne(Wrappers.<AutomationRecordBinding>lambdaQuery()
                .eq(AutomationRecordBinding::getJobCode, jobCode)
                .eq(AutomationRecordBinding::getBusinessKey, businessKey)
                .eq(AutomationRecordBinding::getTargetType, targetType)
                .eq(AutomationRecordBinding::getTargetResource, targetResource)
                .last("LIMIT 1"));
    }

    @Override
    public AutomationRecordBinding bind(AutomationRecordBinding binding) {
        AutomationRecordBinding current = find(binding.getJobCode(), binding.getBusinessKey(),
                binding.getTargetType(), binding.getTargetResource());
        binding.setLastSyncedAt(LocalDateTime.now());
        if (current == null) {
            binding.setTerminal(binding.getTerminal() == null ? 0 : binding.getTerminal());
            mapper.insert(binding);
            return binding;
        }
        binding.setId(current.getId());
        mapper.updateById(binding);
        return binding;
    }

    @Override
    public void markTerminal(Long bindingId, String businessStatus) {
        AutomationRecordBinding update = new AutomationRecordBinding();
        update.setId(bindingId);
        update.setTerminal(1);
        update.setLastBusinessStatus(businessStatus);
        update.setLastSyncedAt(LocalDateTime.now());
        mapper.updateById(update);
    }
}
