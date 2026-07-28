// import { Role } from 'generated/prisma/enums';
import { IsEmail, IsIn, IsNotEmpty, MinLength } from 'class-validator';
export class LoginDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;

    @MinLength(8)
    password: string;
}