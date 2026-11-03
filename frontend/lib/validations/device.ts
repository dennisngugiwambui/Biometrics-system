/**
 * Zod validation schemas for Device entities.
 * 
 * Matches the backend Pydantic schemas in shared/schemas/device.py
 */

import { z } from 'zod';

/**
 * Device status enumeration.
 */
export const deviceStatusEnum = z.enum(['online', 'offline', 'unknown']);

/**
 * IP address validation (IPv4 or IPv6).
 */
export const ipAddressSchema = z
  .string()
  .min(1, 'IP address is required')
  .refine(
    (val) => {
      // IPv4 regex
      const ipv4Regex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      // IPv6 regex (simplified - matches standard IPv6 formats)
      const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}([0-9a-fA-F]{1,4}|:)$|^::1$|^::$|^([0-9a-fA-F]{1,4}:)*::([0-9a-fA-F]{1,4}:)*([0-9a-fA-F]{1,4})?$|^([0-9a-fA-F]{1,4}:)*::([0-9a-fA-F]{1,4}:)*([0-9a-fA-F]{1,4})?$/;
      
      return ipv4Regex.test(val) || ipv6Regex.test(val);
    },
    { message: 'Invalid IP address format (must be IPv4 or IPv6)' }
  );

/**
 * Device form validation schema (for create).
 */
export const deviceFormSchema = z.object({
  name: z
    .string()
    .min(1, 'Device name is required')
    .max(200, 'Device name must be less than 200 characters'),

  // direct: the server reaches the device on its network; cloud: the device calls the server over the internet
  connection_mode: z.enum(['direct', 'cloud']).default('direct'),

  ip_address: z.union([ipAddressSchema, z.literal('')]).nullable().optional()
    .transform((val) => (val === '' ? null : val)),
  
  port: z
    .number()
    .int('Port must be an integer')
    .min(1, 'Port must be between 1 and 65535')
    .max(65535, 'Port must be between 1 and 65535')
    .default(4370),
  
  com_password: z
    .string()
    .max(20, 'Communication password must be less than 20 characters')
    .nullable()
    .optional()
    .transform((val) => val === '' ? null : val),
  
  serial_number: z
    .string()
    .max(100, 'Serial number must be less than 100 characters')
    .nullable()
    .optional()
    .transform((val) => val === '' ? null : val),
  
  location: z
    .string()
    .max(200, 'Location must be less than 200 characters')
    .nullable()
    .optional()
    .transform((val) => val === '' ? null : val),
  
  description: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val === '' ? null : val),
  
  device_group_id: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional(),
}).superRefine((d, ctx) => {
  if (d.connection_mode === 'direct' && !d.ip_address) {
    ctx.addIssue({ code: 'custom', path: ['ip_address'], message: 'IP address is required for a device on the same network' });
  }
  if (d.connection_mode === 'cloud' && !d.serial_number) {
    ctx.addIssue({ code: 'custom', path: ['serial_number'], message: 'Serial number is required — a cloud device is recognised by it' });
  }
});

/**
 * Device create form data type.
 */
export type DeviceFormData = z.infer<typeof deviceFormSchema>;

/**
 * Device update form data (all fields optional).
 */
export const deviceUpdateSchema = z.object({
  name: z
    .string()
    .min(1, 'Device name is required')
    .max(200, 'Device name must be less than 200 characters')
    .optional(),
  
  connection_mode: z.enum(['direct', 'cloud']).optional(),

  ip_address: z.union([ipAddressSchema, z.literal('')]).nullable().optional()
    .transform((val) => (val === '' ? null : val)),
  
  port: z
    .number()
    .int('Port must be an integer')
    .min(1, 'Port must be between 1 and 65535')
    .max(65535, 'Port must be between 1 and 65535')
    .optional(),
  
  com_password: z
    .string()
    .max(20, 'Communication password must be less than 20 characters')
    .nullable()
    .optional()
    .transform((val) => val === '' ? null : val),
  
  serial_number: z
    .string()
    .max(100, 'Serial number must be less than 100 characters')
    .nullable()
    .optional()
    .transform((val) => val === '' ? null : val),
  
  location: z
    .string()
    .max(200, 'Location must be less than 200 characters')
    .nullable()
    .optional()
    .transform((val) => val === '' ? null : val),
  
  description: z
    .string()
    .nullable()
    .optional()
    .transform((val) => val === '' ? null : val),
  
  device_group_id: z
    .number()
    .int()
    .positive()
    .nullable()
    .optional(),
});

/**
 * Device update form data type.
 */
export type DeviceUpdateFormData = z.infer<typeof deviceUpdateSchema>;

