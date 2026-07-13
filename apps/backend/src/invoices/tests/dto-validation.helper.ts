import { validate, ValidationError } from "class-validator";
import { plainToInstance } from "class-transformer";
import type { ClassConstructor } from "class-transformer";

export async function validateDto<T extends object>(
  cls: ClassConstructor<T>,
  plain: object,
): Promise<ValidationError[]> {
  const instance = plainToInstance(cls, plain);
  return validate(instance, {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}
