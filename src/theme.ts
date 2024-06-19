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
    green: [
      "#e5ffe5",
      "#b2ffb2",
      "#7fff7f",
      "#4cff4c",
      "#19ff19",
      "#00e600",
      "#00b300",
      "#008000",
      "#004d00",
      "#001a00",
    ],
    purple: [
      "#f5e5ff",
      "#e2b2ff",
      "#ce7fff",
      "#ba4cff",
      "#a519ff",
      "#8c00e6",
      "#6900b3",
      "#460080",
      "#23004d",
      "#0a001a",
    ],
    orange: [
      "#fff0e5",
      "#ffd9b2",
      "#ffc27f",
      "#ffaa4c",
      "#ff9319",
      "#e67a00",
      "#b35e00",
      "#804200",
      "#4d2700",
      "#1a0c00",
    ],
  },
  primaryColor: "orange", // Change this to "red", "green", "purple", "orange", etc.
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
