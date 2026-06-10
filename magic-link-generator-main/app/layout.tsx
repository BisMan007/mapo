import "@mantine/core/styles.css";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <MantineProvider>
          <Notifications position="top-right"
            styles={{
              root: {
                width: "25%",
                maxWidth: 360, 
              },
            }}
          />
          {children}
        </MantineProvider>
      </body>
    </html>
  );
}
