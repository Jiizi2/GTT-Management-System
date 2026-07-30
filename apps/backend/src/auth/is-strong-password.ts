import { registerDecorator, ValidationOptions, ValidationArguments } from "class-validator";
import { validatePasswordStrength } from "./auth-password-validation";

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isStrongPassword",
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, _args: ValidationArguments) {
          if (typeof value !== "string") return false;
          return validatePasswordStrength(value).valid;
        },
        defaultMessage(args: ValidationArguments) {
          if (typeof args.value !== "string") return "Password must be a string";
          const { errors } = validatePasswordStrength(args.value);
          return errors.join(", ");
        },
      },
    });
  };
}
