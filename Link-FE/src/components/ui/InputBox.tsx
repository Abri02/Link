import { chakra } from "@chakra-ui/react";
import { bareInputRecipe, inputBoxRecipe } from "@/theme/recipes";

/** Bordered box that highlights while anything inside it has focus. */
export const InputBox = chakra("div", inputBoxRecipe);

/** Borderless input for use inside an InputBox, which provides the focus indicator. */
export const BareInput = chakra("input", bareInputRecipe);
