import '../src/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../src/domain/security';
const db=new PrismaClient();
async function main(){const email=(process.env.OWNER_EMAIL||'kashmitha@localhost').toLowerCase(),password=process.env.OWNER_PASSWORD;if(!password||password.length<12)throw new Error('Run npm run setup and set a unique OWNER_PASSWORD with at least 12 characters.');await db.user.upsert({where:{email},create:{email,passwordHash:hashPassword(password)},update:{}});await db.automationSettings.upsert({where:{id:'owner'},create:{id:'owner'},update:{}});console.log('Owner and paused automation created. No fabricated financial, traffic or publication data seeded.');}
main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
