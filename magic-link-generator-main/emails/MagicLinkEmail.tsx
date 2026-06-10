import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Button,
} from "@react-email/components";

interface MagicLinkEmailProps {
  name: string;
  magicLink: string;
}

export default function MagicLinkEmail({
  name,
  magicLink,
}: MagicLinkEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#f6f9fc", padding: "20px" }}>
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "24px",
            borderRadius: "8px",
          }}
        >
          <Text>Hello {name},</Text>

          <Text>
            Thanks for submitting your details. Click the button below to
            confirm your email:
          </Text>

          <Button
            href={magicLink}
            style={{
              backgroundColor: "#000",
              color: "#fff",
              padding: "12px 20px",
              borderRadius: "6px",
            }}
          >
            Confirm Submission
          </Button>

          <Text style={{ marginTop: "24px", fontSize: "12px", color: "#666" }}>
            This link will expire in 15 minutes.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
