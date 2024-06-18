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
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
  },
  shadows: {
    xs: "0 1px 3px rgba(0, 0, 0, 0.12)",
    sm: "0 2px 6px rgba(0, 0, 0, 0.16)",
    md: "0 4px 12px rgba(0, 0, 0, 0.24)",
    lg: "0 8px 16px rgba(0, 0, 0, 0.32)",
    xl: "0 12px 24px rgba(0, 0, 0, 0.4)",
  },
  components: {
    Button: {
      styles: (theme) => ({
        root: {
          borderRadius: theme.radius.md,
          padding: "0.75rem 1.5rem",
        },
      }),
    },
    Card: {
      styles: (theme) => ({
        root: {
          borderRadius: theme.radius.lg,
          boxShadow: theme.shadows.md,
          padding: theme.spacing.md,
        },
      }),
    },
  },
});
