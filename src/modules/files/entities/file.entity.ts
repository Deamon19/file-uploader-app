import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

export enum FileStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

@Entity('files')
export class File {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'text' })
  originalUrl: string

  @Column({ type: 'text', nullable: true })
  fileName: string | null

  @Column({ type: 'varchar', length: 255, nullable: true })
  mimeType: string | null

  @Column({ type: 'text', nullable: true })
  googleDriveId: string | null

  @Column({ type: 'text', nullable: true })
  googleDriveLink: string | null

  @Column({
    type: 'enum',
    enum: FileStatus,
    default: FileStatus.PENDING
  })
  status: FileStatus

  @Column({ type: 'text', nullable: true })
  errorMessage: string | null

  @CreateDateColumn()
  createdAt: Date

  @UpdateDateColumn()
  updatedAt: Date
}
