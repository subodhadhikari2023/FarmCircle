import { Role } from 'generated/prisma/enums';
import { IsEmail, IsIn, IsNotEmpty, MinLength } from 'class-validator';

export type RegisterableRoles = Extract<Role, 'CUSTOMER' | 'VENDOR'>;
export class RegisterDto {
  // constructor (email:string, password:string, name:string, role: RegisterableRoles){
  //     this.email=email
  //     this.name=name
  //     this.password=password
  //     this.role=role
  // }

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @MinLength(6)
  password: string;

  @IsNotEmpty()
  name: string;

  @IsIn(['VENDOR', 'CUSTOMER'])
  role: RegisterableRoles;
}
