import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../../common/decorators.js';
import { UserRole } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@Injectable()
export class UploadsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private client() {
    const endpoint = this.configService.get<string>('S3_ENDPOINT');
    const accessKey = this.configService.get<string>('S3_ACCESS_KEY');
    const secretKey = this.configService.get<string>('S3_SECRET_KEY');
    if (!endpoint || !accessKey || !secretKey) {
      throw new ServiceUnavailableException(
        'Object storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY and S3_SECRET_KEY.',
      );
    }
    return new S3Client({
      endpoint,
      region: this.configService.get<string>('S3_REGION', 'us-east-1'),
      forcePathStyle: true,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
  }

  async signUpload(
    user: AuthenticatedUser,
    input: {
      fileName: string;
      contentType: string;
      sizeBytes: number;
      entityType?: string | null;
      entityId?: string | null;
    },
  ) {
    const bucket = this.configService.getOrThrow<string>('S3_BUCKET');
    const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `users/${user.id}/${randomUUID()}-${safeName}`;

    const asset = await this.prisma.fileAsset.create({
      data: {
        objectKey,
        bucket,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
        ownerUserId: user.id,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        originalFileName: input.fileName,
      },
    });

    const url = await getSignedUrl(
      this.client(),
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: input.contentType,
      }),
      { expiresIn: 900 },
    );
    return { assetId: asset.id, objectKey, uploadUrl: url, expiresIn: 900 };
  }

  async signedUrl(user: AuthenticatedUser, id: string) {
    const asset = await this.prisma.fileAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('File asset not found');
    if (
      asset.ownerUserId !== user.id &&
      ![UserRole.MANAGER, UserRole.ADMIN, UserRole.OPERATOR].some((value) => value === user.role)
    ) {
      throw new ForbiddenException('You cannot access this file');
    }

    const url = await getSignedUrl(
      this.client(),
      new GetObjectCommand({ Bucket: asset.bucket, Key: asset.objectKey }),
      { expiresIn: 300 },
    );
    return { url, expiresIn: 300, contentType: asset.contentType };
  }
}
