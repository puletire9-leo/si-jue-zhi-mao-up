package test;

import lombok.Data;

@Data
public class App {
    private String name;
    private int value;

    public static void main(String[] args) {
        App app = new App();
        app.setName("test");
        app.setValue(42);
        System.out.println("Name: " + app.getName() + ", Value: " + app.getValue());
    }
}
