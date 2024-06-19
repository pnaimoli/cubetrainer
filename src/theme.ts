import { createTheme, MantineThemeOverride } from "@mantine/core";

export const theme: MantineThemeOverride = createTheme({
  fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
  headings: {
    fontFamily: "Avenir, system-ui, Helvetica, Arial, sans-serif",
    fontWeight: 700,
  },
  primaryColor: "green", // Change this to "red", "green", "orange", etc.
  components: {
    Button: {
      styles: (theme) => ({
        root: {
          borderRadius: theme.radius.md,
        },
      }),
    },
  },
});
