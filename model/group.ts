import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  BaseEntity
} from 'typeorm';

export enum PrivacyEnum {
  PUBLIC = 'public',
  PRIVATE = 'private'
}

@Entity('groups')
export class Group extends BaseEntity {
  @Column({
    type: 'varchar',
    unique: true,
    nullable: false
  })
  id: string;

  @Column({
    type: 'varchar',
    unique: true,
    nullable: false
  })
  displayName: string;

  @Column({
    type: 'jsonb',
    nullable: true
  })
  metadata: Record<string, any>;

  @CreateDateColumn()
  created_at: string;

  @UpdateDateColumn()
  updated_at: string;
}
