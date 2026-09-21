import { BadRequestException } from "@nestjs/common";

export class InsufficientFundsException extends BadRequestException {
  constructor(required: number, available: number) {
    super(`Insufficient Crédits Rail balance: required ${required}, available ${available}`);
  }
}
