import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import { actionClient, success, error } from "@/lib/actions";

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().min(0),
});

describe("actionClient", () => {
  it("should return success with valid input", async () => {
    const testAction = actionClient.schema(testSchema).action(async (ctx) => {
      return { greeting: `Hello ${ctx.parsedInput.name}` };
    });

    const result = await testAction({ name: "Test", age: 25 });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.greeting).toBe("Hello Test");
    }
  });

  it("should return field errors with invalid input", async () => {
    const testAction = actionClient.schema(testSchema).action(async () => {
      return { greeting: "should not reach" };
    });

    const result = await testAction({ name: "", age: -1 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Datos inválidos");
      expect(result.fieldErrors).toBeDefined();
    }
  });

  it("should catch handler errors gracefully", async () => {
    const testAction = actionClient.schema(testSchema).action(async () => {
      throw new Error("DB connection failed");
    });

    const result = await testAction({ name: "Test", age: 25 });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Ha ocurrido un error inesperado");
    }
  });
});

describe("helpers", () => {
  it("success() creates correct shape", () => {
    const result = success({ id: "123" });
    expect(result).toEqual({ success: true, data: { id: "123" } });
  });

  it("error() creates correct shape", () => {
    const result = error("failed", { name: ["required"] });
    expect(result).toEqual({
      success: false,
      error: "failed",
      fieldErrors: { name: ["required"] },
    });
  });
});
