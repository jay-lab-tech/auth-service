import { prisma } from '../../config/database.js';
import { hashPassword } from '../../utils/password.js';
import type { RegisterInput } from './auth.schemas.js'

export async function registerUser(input: RegisterInput) {
    const passwordHash = await hashPassword(input.password);

    return prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
            data: {
                name: input.name,
                email: input.email,
                passwordHash,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isActive: true,
                createdAt: true,
            },
        });
        await transaction.auditLog.create({
            data: {
                userId: user.id,
                action: 'REGISTER',
                status: 'SUCCESS',
            },
        });
        return user;
    });
}