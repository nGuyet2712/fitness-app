import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSetup1794856507127 implements MigrationInterface {
  name = 'InitialSetup1794856507127';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "muscle_groups" ("id" uuid NOT NULL, "name" character varying(100) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_87e03ee9f78be5d7a7d0e08897e" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "exercises" ("id" uuid NOT NULL, "name" character varying(100) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_c4c46f5fa89a58ba7c2d894e3c3" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "workout_entries" ("id" uuid NOT NULL, "userId" uuid NOT NULL, "exerciseId" uuid NOT NULL, "performedAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_cddd8bd055bac158baae9a3b2c4" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_workout_entries_user_exercise_performed" ON "workout_entries" ("userId", "exerciseId", "performedAt") `,
    );
    await queryRunner.query(
      `CREATE TABLE "exercise_sets" ("id" uuid NOT NULL, "workoutEntryId" uuid NOT NULL, "setOrder" smallint NOT NULL, "reps" integer NOT NULL, "weight" numeric(9,3) NOT NULL, "unit" character varying(100) NOT NULL, "weightKg" numeric(9,3) NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_exercise_sets_set_order_positive" CHECK ("setOrder" >= 1), CONSTRAINT "CHK_exercise_sets_weight_kg_non_negative" CHECK ("weightKg" >= 0), CONSTRAINT "CHK_exercise_sets_weight_non_negative" CHECK ("weight" >= 0), CONSTRAINT "CHK_exercise_sets_reps_positive" CHECK ("reps" > 0), CONSTRAINT "PK_113166a6f1f6e3ab3bd47ebf992" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_exercise_sets_entry_order" ON "exercise_sets" ("workoutEntryId", "setOrder") `,
    );
    await queryRunner.query(
      `CREATE TABLE "exercise_muscle_groups" ("exerciseId" uuid NOT NULL, "muscleGroupId" uuid NOT NULL, CONSTRAINT "PK_d7b9fb66bfef765c72d036a3d90" PRIMARY KEY ("exerciseId", "muscleGroupId"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6a436ca001794439ef5b5b8188" ON "exercise_muscle_groups" ("exerciseId") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cd52312eae8e20ddc3b8de5ab3" ON "exercise_muscle_groups" ("muscleGroupId") `,
    );
    await queryRunner.query(
      `ALTER TABLE "workout_entries" ADD CONSTRAINT "FK_0e7d316721967712a750d54effd" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise_sets" ADD CONSTRAINT "FK_0e164c9f7ad2c24370e1171759a" FOREIGN KEY ("workoutEntryId") REFERENCES "workout_entries"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise_muscle_groups" ADD CONSTRAINT "FK_6a436ca001794439ef5b5b8188f" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise_muscle_groups" ADD CONSTRAINT "FK_cd52312eae8e20ddc3b8de5ab38" FOREIGN KEY ("muscleGroupId") REFERENCES "muscle_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_exercises_name_lower" ON "exercises" (LOWER("name"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_muscle_groups_name_lower" ON "muscle_groups" (LOWER("name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exercise_muscle_groups" DROP CONSTRAINT "FK_cd52312eae8e20ddc3b8de5ab38"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise_muscle_groups" DROP CONSTRAINT "FK_6a436ca001794439ef5b5b8188f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "exercise_sets" DROP CONSTRAINT "FK_0e164c9f7ad2c24370e1171759a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workout_entries" DROP CONSTRAINT "FK_0e7d316721967712a750d54effd"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_cd52312eae8e20ddc3b8de5ab3"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_6a436ca001794439ef5b5b8188"`,
    );
    await queryRunner.query(`DROP TABLE "exercise_muscle_groups"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_exercise_sets_entry_order"`,
    );
    await queryRunner.query(`DROP TABLE "exercise_sets"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_workout_entries_user_exercise_performed"`,
    );
    await queryRunner.query(`DROP TABLE "workout_entries"`);
    await queryRunner.query(`DROP TABLE "exercises"`);
    await queryRunner.query(`DROP TABLE "muscle_groups"`);
    await queryRunner.query(`DROP INDEX "public"."UQ_exercises_name_lower"`);
    await queryRunner.query(
      `DROP INDEX "public"."UQ_muscle_groups_name_lower"`,
    );
  }
}
