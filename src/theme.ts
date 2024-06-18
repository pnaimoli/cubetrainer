import { createTheme, MantineThemeOverride } from "@mantine/core";

export const theme: MantineThemeOverride = createTheme({
  fontFamily: "Inter, system-ui, Avenir, Helvetica, Arial, sans-serif",
  headings: {
    fontFamily: "Avenir, system-ui, Helvetica, Arial, sans-serif",
    fontWeight: 700,
  },
  colors: {
    brand: [
      "#f0f4ff",
      "#d9e2ff",
      "#b3c6ff",
      "#8aa8ff",
      "#618bff",
      "#3b6eff",
      "#1c4bff",
      "#0033cc",
      "#002699",
      "#001966",
    ],
  },
  primaryColor: "brand",
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
