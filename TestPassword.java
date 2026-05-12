import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

public class test {
    public static void main(String[] args) {
        BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(12);
        String rawPassword = "123456";
        String hashedPassword = encoder.encode(rawPassword);
        System.out.println("Generated BCrypt hash for '123456':");
        System.out.println(hashedPassword);
        System.out.println("\nVerification:");
        System.out.println("Matches: " + encoder.matches(rawPassword, hashedPassword));
    }
}
