package com.sjzm;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class TestRunner implements CommandLineRunner {
    @Override
    public void run(String... args) {
        TestEntity entity = new TestEntity();
        entity.setName("test");
        entity.setAge(25);

        System.out.println("Lombok Test: name=" + entity.getName() + ", age=" + entity.getAge());
        System.out.println("Lombok is working!");
    }
}
