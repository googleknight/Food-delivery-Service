import {
  parseFieldSelection,
  USER_SELECTABLE_FIELDS,
} from "../../src/utils/fieldSelection";
import { ValidationError } from "../../src/utils/errors";

describe("parseFieldSelection Utility", () => {
  const whitelist = USER_SELECTABLE_FIELDS;

  it("should return undefined for empty or undefined fieldsParam", () => {
    expect(parseFieldSelection(undefined, whitelist)).toBeUndefined();
    expect(parseFieldSelection("", whitelist)).toBeUndefined();
    expect(parseFieldSelection("   ", whitelist)).toBeUndefined();
  });

  it("should return a select object for valid fields", () => {
    const result = parseFieldSelection("id,email,name", whitelist);
    expect(result).toEqual({
      id: true,
      email: true,
      name: true,
    });
  });

  it("should always include id in the select object", () => {
    const result = parseFieldSelection("email,name", whitelist);
    expect(result).toEqual({
      id: true,
      email: true,
      name: true,
    });
  });

  it("should handle spaces in fieldsParam", () => {
    const result = parseFieldSelection(" id ,  email , name ", whitelist);
    expect(result).toEqual({
      id: true,
      email: true,
      name: true,
    });
  });

  it("should throw ValidationError for sensitive fields (password)", () => {
    expect(() => parseFieldSelection("id,password", whitelist)).toThrow(
      ValidationError,
    );
    expect(() => parseFieldSelection("id,password", whitelist)).toThrow(
      /Cannot select sensitive fields: password/,
    );
  });

  it("should throw ValidationError for fields not in whitelist", () => {
    expect(() => parseFieldSelection("id,fakeField", whitelist)).toThrow(
      ValidationError,
    );
    expect(() => parseFieldSelection("id,fakeField", whitelist)).toThrow(
      /Invalid fields: fakeField/,
    );
  });
});
