import { defineTextStyles } from "@chakra-ui/react";

export const textStyles = defineTextStyles({
  display: {
    value: { fontFamily: "display", fontSize: "40px", fontWeight: "500", lineHeight: "1.15" },
  },
  title: {
    value: { fontFamily: "body", fontSize: "18px", fontWeight: "600", lineHeight: "1.35" },
  },
  body: {
    value: { fontFamily: "body", fontSize: "14px", fontWeight: "400", lineHeight: "1.5" },
  },
  label: {
    value: { fontFamily: "body", fontSize: "13px", fontWeight: "500", lineHeight: "1.4" },
  },
  caption: {
    value: { fontFamily: "body", fontSize: "12px", fontWeight: "400", lineHeight: "1.4" },
  },
});
