package com.sjzm.user.service;

import com.sjzm.user.dto.LoginRequest;
import com.sjzm.user.dto.LoginResponse;
import com.sjzm.user.dto.RegisterRequest;
import com.sjzm.user.entity.User;

public interface AuthService {

    LoginResponse login(LoginRequest request);

    void register(RegisterRequest request);

    LoginResponse refresh(String refreshToken);

    void logout(String accessToken);

    User getUserById(Long id);
}
