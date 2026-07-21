import type { GlobalProvider } from "@ladle/react";

import "@fontsource/chakra-petch/500.css";
import "@fontsource/chakra-petch/600.css";
import "@fontsource/chakra-petch/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "@fontsource/big-shoulders/600.css";
import "@fontsource/big-shoulders/700.css";
import "@fontsource/big-shoulders/800.css";
import "@fontsource/space-mono/400.css";
import "@fontsource/space-mono/700.css";
import "@fontsource/fraunces/400.css";
import "@fontsource/fraunces/500.css";
import "@fontsource/fraunces/600.css";
import "@fontsource/fraunces/400-italic.css";
import "@fontsource/dm-mono/300.css";
import "@fontsource/dm-mono/400.css";
import "@fontsource/dm-mono/500.css";
import "../src/styles/globals.css";

export const Provider: GlobalProvider = ({ children }) => children;
