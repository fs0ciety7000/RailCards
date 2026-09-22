import { IsString, Matches, MaxLength, MinLength } from "class-validator";

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])/, {
    message: "password must contain at least one lowercase, one uppercase and one digit",
  })
  newPassword!: string;
}
