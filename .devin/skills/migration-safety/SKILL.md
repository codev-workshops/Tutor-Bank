---
name: migration-safety
description: Database migration safety checks for Prisma PostgreSQL migrations including destructive operation detection, rollback safety, and schema validation
triggers: ["user", "model"]
argument-hint: [migration-file]
---

You are an expert in database migration safety. Follow these comprehensive safety checks for all Prisma migrations in this project.

## Pre-Migration Checklist

### Before Running Migrations
Always complete these checks before applying migrations:

1. **Backup Database**
   ```bash
   # Create a backup before running migrations
   pg_dump -U postgres -d tutor_bank > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Review Migration Files**
   - Read all new migration files in `prisma/migrations/`
   - Understand what changes each migration makes
   - Identify potential destructive operations

3. **Test in Development**
   - Run migrations against development database first
   - Verify application works with new schema
   - Test rollback procedures

4. **Schedule Downtime if Needed**
   - For destructive changes, schedule maintenance window
   - Notify users of planned downtime
   - Prepare rollback plan

## Destructive Operation Detection

### Scan for Dangerous Operations
Always scan migration files for these destructive patterns:

```typescript
// Dangerous operations to check for:
const destructivePatterns = [
  "DROP TABLE",
  "DROP COLUMN",
  "DROP INDEX",
  "ALTER TABLE ... DROP COLUMN",
  "TRUNCATE",
  "DELETE FROM", // When used without WHERE clause
  "ALTER COLUMN ... TYPE", // Type changes that lose precision
];
```

### Migration File Review Process
Review each migration file for:

```sql
-- prisma/migrations/20240101000000_example/migration.sql

-- CHECK: Is this dropping a table?
-- DROP TABLE users; -- ❌ DANGEROUS

-- CHECK: Is this removing a column?
-- ALTER TABLE "users" DROP COLUMN "old_column"; -- ❌ DANGEROUS

-- CHECK: Is this truncating data?
-- TRUNCATE TABLE "sessions"; -- ❌ DANGEROUS

-- CHECK: Is this changing type with data loss?
-- ALTER TABLE "users" ALTER COLUMN "bio" TYPE VARCHAR(50); -- ❌ DANGEROUS if bio > 50 chars

-- SAFE operations:
-- ALTER TABLE "users" ADD COLUMN "new_column" TEXT; -- ✅ SAFE
-- CREATE INDEX "index_name" ON "users"("email"); -- ✅ SAFE
-- ALTER TABLE "users" ALTER COLUMN "name" TYPE VARCHAR(255); -- ✅ SAFE if expanding size
```

### Automated Safety Check Script
Create a script to automatically check migrations:

```typescript
// scripts/check-migrations.ts
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const destructivePatterns = [
  /DROP TABLE/i,
  /DROP COLUMN/i,
  /DROP INDEX/i,
  /TRUNCATE/i,
  /DELETE FROM\s+/i,
  /ALTER TABLE.*DROP COLUMN/i,
];

function checkMigrationFile(migrationPath: string): { safe: boolean; issues: string[] } {
  const content = readFileSync(migrationPath, "utf-8");
  const issues: string[] = [];
  
  for (const pattern of destructivePatterns) {
    if (pattern.test(content)) {
      const match = content.match(pattern);
      issues.push(`Found potentially destructive operation: ${match?.[0]}`);
    }
  }
  
  return {
    safe: issues.length === 0,
    issues,
  };
}

function checkAllMigrations(): void {
  const migrationsDir = join(process.cwd(), "prisma", "migrations");
  const migrationDirs = readdirSync(migrationsDir);
  
  let hasIssues = false;
  
  for (const dir of migrationDirs) {
    const migrationFile = join(migrationsDir, dir, "migration.sql");
    try {
      const result = checkMigrationFile(migrationFile);
      if (!result.safe) {
        console.log(`❌ Issues in ${dir}:`);
        result.issues.forEach(issue => console.log(`  - ${issue}`));
        hasIssues = true;
      } else {
        console.log(`✅ ${dir} is safe`);
      }
    } catch (error) {
      console.log(`⚠️  Could not check ${dir}: ${error}`);
    }
  }
  
  if (hasIssues) {
    process.exit(1);
  }
}

checkAllMigrations();
```

## Foreign Key Index Verification

### Check for Missing Indexes
Every foreign key should have a corresponding index for performance:

```typescript
// scripts/check-foreign-keys.ts
import { PrismaClient } from "@/generated/prisma/client";

const prisma = new PrismaClient();

async function checkForeignKeyIndexes(): Promise<void> {
  // Get all foreign key constraints
  const foreignKeys = await prisma.$queryRaw<Array<{
    table_name: string;
    column_name: string;
    foreign_table_name: string;
  }>>`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
  `;
  
  for (const fk of foreignKeys) {
    // Check if index exists
    const indexExists = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = ${fk.table_name}
      AND indexdef LIKE ${`%${fk.column_name}%`}
    `;
    
    if (indexExists.length === 0) {
      console.warn(`⚠️  Missing index on ${fk.table_name}.${fk.column_name} (foreign key to ${fk.foreign_table_name})`);
    }
  }
}

checkForeignKeyIndexes();
```

### Add Missing Indexes
If missing indexes are found, add them to your schema:

```prisma
// prisma/schema.prisma

model Booking {
  id        String   @id @default(cuid())
  studentId String
  tutorId   String
  slotId    String   @unique
  
  student   User     @relation("StudentBookings", fields: [studentId], references: [id], onDelete: Cascade)
  tutor     User     @relation("TutorBookings", fields: [tutorId], references: [id], onDelete: Cascade)
  slot      TimeSlot @relation(fields: [slotId], references: [id], onDelete: Cascade)
  
  @@index([studentId])  // Add this index
  @@index([tutorId])    // Add this index
  @@index([slotId])     // Add this index
}
```

## Rollback Safety Testing

### Test Rollback Procedures
Always test that migrations can be rolled back:

```bash
# Apply migration
npx prisma migrate deploy

# Test rollback (if using a migration tool that supports it)
npx prisma migrate resolve --rolled-back [migration-name]

# Or manually rollback the SQL
psql -U postgres -d tutor_bank -f prisma/migrations/[migration-name]/rollback.sql
```

### Create Rollback Scripts
For each migration, create a corresponding rollback script:

```sql
-- prisma/migrations/20240101000000_add_user_bio/rollback.sql

-- Rollback: Remove bio column from users
ALTER TABLE "users" DROP COLUMN IF EXISTS "bio";
```

### Automated Rollback Testing
Test rollback safety automatically:

```typescript
// scripts/test-rollback.ts
import { execSync } from "child_process";
import { readdirSync } from "fs";
import { join } from "path";

async function testRollback(migrationName: string): Promise<boolean> {
  try {
    console.log(`Testing rollback for ${migrationName}...`);
    
    // Apply migration
    execSync(`npx prisma migrate deploy`, { stdio: "inherit" });
    
    // Rollback migration
    execSync(`npx prisma migrate resolve --rolled-back ${migrationName}`, { 
      stdio: "inherit" 
    });
    
    console.log(`✅ Rollback successful for ${migrationName}`);
    return true;
  } catch (error) {
    console.error(`❌ Rollback failed for ${migrationName}:`, error);
    return false;
  }
}

async function testAllRollbacks(): Promise<void> {
  const migrationsDir = join(process.cwd(), "prisma", "migrations");
  const migrationDirs = readdirSync(migrationsDir).sort().reverse(); // Test newest first
  
  let allPassed = true;
  
  for (const dir of migrationDirs) {
    const passed = await testRollback(dir);
    if (!passed) {
      allPassed = false;
    }
  }
  
  if (!allPassed) {
    console.error("❌ Some rollbacks failed");
    process.exit(1);
  }
}

testAllRollbacks();
```

## Schema File Validation

### Validate Schema Consistency
Ensure `prisma/schema.prisma` matches the actual database:

```bash
# Format schema
npx prisma format

# Validate schema
npx prisma validate

# Check if schema is up to date with migrations
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma
```

### Automated Schema Validation
Create a script to validate schema consistency:

```typescript
// scripts/validate-schema.ts
import { execSync } from "child_process";

function validateSchema(): void {
  try {
    console.log("Validating Prisma schema...");
    execSync("npx prisma validate", { stdio: "inherit" });
    console.log("✅ Schema is valid");
  } catch (error) {
    console.error("❌ Schema validation failed");
    process.exit(1);
  }
}

validateSchema();
```

## Data Backup Requirements

### Mandatory Backup Before Destructive Changes
Before running any migration with destructive operations:

```bash
#!/bin/bash
# scripts/backup-before-migration.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backups/tutor_bank_${TIMESTAMP}.sql"

echo "Creating backup: $BACKUP_FILE"
mkdir -p backups

pg_dump -U postgres -d tutor_bank > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
  echo "✅ Backup created successfully"
  echo "Backup file: $BACKUP_FILE"
else
  echo "❌ Backup failed"
  exit 1
fi
```

### Verify Backup Integrity
Always verify that backups can be restored:

```bash
# Test backup restoration (to a test database)
createdb tutor_bank_test_restore
psql -U postgres -d tutor_bank_test_restore < backups/tutor_bank_20240101_120000.sql

# Verify data
psql -U postgres -d tutor_bank_test_restore -c "SELECT COUNT(*) FROM \"User\";"

# Clean up test database
dropdb tutor_bank_test_restore
```

## Migration Testing Procedure

### Complete Migration Testing Workflow
Follow this procedure for testing migrations:

```bash
#!/bin/bash
# scripts/test-migration.sh

MIGRATION_NAME=$1

if [ -z "$MIGRATION_NAME" ]; then
  echo "Usage: ./test-migration.sh <migration-name>"
  exit 1
fi

echo "🧪 Testing migration: $MIGRATION_NAME"

# 1. Create test database
echo "Creating test database..."
createdb tutor_bank_test || { echo "Failed to create test database"; exit 1; }

# 2. Run migrations on test database
echo "Applying migrations to test database..."
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tutor_bank_test" \
  npx prisma migrate deploy || { echo "Migration failed"; dropdb tutor_bank_test; exit 1; }

# 3. Run application tests
echo "Running application tests..."
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tutor_bank_test" \
  npm test || { echo "Tests failed"; dropdb tutor_bank_test; exit 1; }

# 4. Test rollback
echo "Testing rollback..."
npx prisma migrate resolve --rolled-back "$MIGRATION_NAME" || \
  { echo "Rollback failed"; dropdb tutor_bank_test; exit 1; }

# 5. Clean up
echo "Cleaning up test database..."
dropdb tutor_bank_test

echo "✅ Migration testing complete: $MIGRATION_NAME"
```

## Model Tests After Schema Changes

### Run Model Tests
After any schema change, run model tests to ensure validations and associations still work:

```bash
# Run all tests
npm test

# Run specific model tests
npm test -- src/test/models/user.test.ts
npm test -- src/test/models/booking.test.ts
```

### Update Tests for New Schema
If schema changes, update tests accordingly:

```typescript
// Example: Update test after adding new field
describe("User model", () => {
  it("should create user with new bio field", async () => {
    const user = await prisma.user.create({
      data: {
        email: "test@example.com",
        name: "Test User",
        passwordHash: await bcrypt.hash("password", 10),
        role: "STUDENT",
        bio: "Test bio", // New field
      },
    });
    
    expect(user.bio).toBe("Test bio");
  });
});
```

## Production Migration Procedure

### Safe Production Migration Workflow
Follow this procedure for production migrations:

```bash
#!/bin/bash
# scripts/production-migrate.sh

echo "🚀 Starting production migration procedure"

# 1. Pre-migration checks
echo "Running pre-migration checks..."
npm run check-migrations || { echo "Migration safety check failed"; exit 1; }
npm run validate-schema || { echo "Schema validation failed"; exit 1; }

# 2. Create backup
echo "Creating production backup..."
./scripts/backup-before-migration.sh || { echo "Backup failed"; exit 1; }

# 3. Put application in maintenance mode (if needed)
echo "Putting application in maintenance mode..."
# Add your maintenance mode logic here

# 4. Apply migration
echo "Applying migration..."
npx prisma migrate deploy || { echo "Migration failed"; exit 1; }

# 5. Run smoke tests
echo "Running smoke tests..."
npm run test:smoke || { echo "Smoke tests failed"; exit 1; }

# 6. Take application out of maintenance mode
echo "Taking application out of maintenance mode..."
# Add your maintenance mode logic here

# 7. Monitor for errors
echo "Monitoring for errors..."
# Add your monitoring logic here

echo "✅ Production migration complete"
```

## Project-Specific Migration Patterns

### Current Project Schema Considerations
Given the current schema with these relationships:
- User ↔ TutorSubject ↔ Subject (many-to-many)
- User ↔ TimeSlot (one-to-many)
- User ↔ Booking (one-to-many as student and tutor)
- Booking ↔ TimeSlot (one-to-one)

### Special Considerations
1. **Cascade Deletes**: The schema uses `onDelete: Cascade`. Test these carefully:
   ```sql
   -- Test: Deleting a user should cascade to their bookings
   -- Test: Deleting a subject should cascade to tutor subjects
   ```

2. **TimeSlot Booking**: The booking system has a one-to-one relationship with slots. Ensure migrations maintain this constraint.

3. **Enum Changes**: If modifying enums (Role, BookingStatus), ensure data migration handles existing values.

## Migration Safety Checklist

Before applying any migration, verify:

- [ ] Database backup created and verified
- [ ] Migration file reviewed for destructive operations
- [ ] Foreign key indexes verified
- [ ] Rollback procedure tested
- [ ] Schema file validated
- [ ] Model tests pass with new schema
- [ ] Migration tested in development environment
- [ ] Application tested with new schema
- [ ] Maintenance window scheduled (if needed)
- [ ] Rollback plan documented
- [ ] Team notified of changes
- [ ] Monitoring set up for post-migration

## Emergency Rollback Procedure

If a production migration causes issues:

```bash
#!/bin/bash
# scripts/emergency-rollback.sh

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./emergency-rollback.sh <backup-file>"
  exit 1
fi

echo "🚨 EMERGENCY ROLLBACK INITIATED"

# 1. Stop application
echo "Stopping application..."
# Add your application stop logic

# 2. Restore from backup
echo "Restoring from backup: $BACKUP_FILE"
psql -U postgres -d tutor_bank < "$BACKUP_FILE" || { echo "Restore failed"; exit 1; }

# 3. Verify data integrity
echo "Verifying data integrity..."
# Add your verification logic

# 4. Start application
echo "Starting application..."
# Add your application start logic

echo "✅ Emergency rollback complete"
```

## Monitoring Post-Migration

After applying migrations, monitor:

```typescript
// Monitor for:
// - Increased error rates in application logs
// - Slow query performance
// - Data integrity issues
// - Connection pool exhaustion
// - Application crashes

// Set up alerts for:
// - Error rate > 1%
// - Query duration > 1s
// - Failed transactions
// - Database connection errors
```

## Migration Documentation

Document every migration with:

```markdown
## Migration: [migration-name]

### Date
YYYY-MM-DD

### Description
Brief description of what the migration does

### Changes
- List of schema changes
- Data migrations if any
- Performance impact

### Risks
- Potential risks identified
- Mitigation strategies

### Rollback Plan
- Steps to rollback if needed
- Data loss potential

### Testing
- How the migration was tested
- Test results

### Production Deployment
- Date deployed
- Any issues encountered
- Post-deployment monitoring results
```