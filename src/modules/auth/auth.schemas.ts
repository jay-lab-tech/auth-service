import { z } from 'zod';

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());

export const registerSchema = z.strictObject({
    name: z.string().trim().min(2).max(80),
    email: emailSchema,
    password: z.string().min(12).max(128),
});

export const loginSchema = z.strictObject({
    email: emailSchema,
    password: z.string().min(1).max(128),
});

export const refreshSchema = z.strictObject({
    refreshToken: z.string().min(40).max(200),
});

export const logoutSchema = refreshSchema;

export const changeRoleSchema = z.strictObject({
    role: z.enum(['USER', 'ADMIN']),
});

export const paginationSchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
