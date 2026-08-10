import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { DEPARTMENT_NAMES } from "../src/constants/lookups";
import { Counter } from "../src/models/Counter";
import { DailyUpdate } from "../src/models/DailyUpdate";
import { Department } from "../src/models/Department";
import { SampleDocument } from "../src/models/SampleDocument";
import { Supplier } from "../src/models/Supplier";
import { Task } from "../src/models/Task";
import { User } from "../src/models/User";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/alhadara_tasks";

const SEED_PASSWORD = process.env.SEED_PASSWORD || "password123";

async function seed() {
  if (
    process.env.NETLIFY === "true" ||
    process.env.CONTEXT === "production"
  ) {
    throw new Error(
      "Refusing to run seed on Netlify/production. Seed Atlas from a trusted local machine with SEED_PASSWORD set."
    );
  }

  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");

  await Promise.all([
    User.deleteMany({}),
    Department.deleteMany({}),
    Task.deleteMany({}),
    DailyUpdate.deleteMany({}),
    Supplier.deleteMany({}),
    SampleDocument.deleteMany({}),
    Counter.deleteMany({}),
  ]);

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 12);

  const generalManager = await User.create({
    name: "المدير العام",
    email: "gm@alhadara.com",
    passwordHash,
    role: "general_manager",
  });

  const ceo = await User.create({
    name: "المدير التنفيذي",
    email: "ceo@alhadara.com",
    passwordHash,
    role: "ceo",
  });

  const managerInfos = [
    { name: "مدير المشتريات", email: "procurement@alhadara.com" },
    { name: "مدير اللوجستيات", email: "logistics@alhadara.com" },
    { name: "مدير الجودة", email: "quality@alhadara.com" },
    { name: "مدير المالية", email: "finance@alhadara.com" },
    { name: "مدير العمليات", email: "operations@alhadara.com" },
  ];

  const managers = [];
  const departments = [];

  for (let i = 0; i < DEPARTMENT_NAMES.length; i++) {
    const manager = await User.create({
      name: managerInfos[i].name,
      email: managerInfos[i].email,
      passwordHash,
      role: "manager",
    });
    managers.push(manager);

    const dept = await Department.create({
      name: DEPARTMENT_NAMES[i],
      managerId: manager._id,
    });
    departments.push(dept);

    manager.departmentId = dept._id;
    await manager.save();
  }

  const iris = await User.create({
    name: "Iris",
    email: "iris@alhadara.com",
    passwordHash,
    role: "employee",
    departmentId: departments[0]._id,
    managerId: managers[0]._id,
  });

  const employeeNames = [
    { name: "أحمد علي", email: "ahmad@alhadara.com", dept: 0 },
    { name: "سارة حسن", email: "sara@alhadara.com", dept: 1 },
    { name: "خالد يوسف", email: "khaled@alhadara.com", dept: 2 },
    { name: "نورا سامي", email: "noura@alhadara.com", dept: 3 },
    { name: "عمر فادي", email: "omar@alhadara.com", dept: 4 },
  ];

  for (const emp of employeeNames) {
    await User.create({
      name: emp.name,
      email: emp.email,
      passwordHash,
      role: "employee",
      departmentId: departments[emp.dept]._id,
      managerId: managers[emp.dept]._id,
    });
  }

  // CEO assigns to managers; managers may later reassign to employees (demo: Iris)
  const tasks = await Task.insertMany([
    {
      taskNo: "PUR-001",
      name: "البحث عن موردي بطاريات UAV",
      description: "البحث والمقارنة بين موردي بطاريات الطائرات بدون طيار",
      assignedDate: new Date("2026-05-25"),
      ownerId: iris._id,
      departmentId: departments[0]._id,
      assignedById: ceo._id,
      priority: "عالية",
      status: "معلقة",
      progress: 0.8,
      lastUpdate: new Date("2026-07-30"),
      nextAction: "انتظار وصول العينات ونتائج الفحص",
      managementDecision: "اختيار المورد النهائي",
      managerApproval: "pending",
    },
    {
      taskNo: "PUR-002",
      name: "البحث عن موردي الريليه",
      description: "البحث عن بدائل للمورد الحالي والحصول على عينات وبيانات فنية",
      assignedDate: new Date("2026-06-15"),
      targetDate: new Date("2026-08-10"),
      ownerId: iris._id,
      departmentId: departments[0]._id,
      assignedById: ceo._id,
      priority: "متوسطة",
      status: "قيد التنفيذ",
      progress: 0.7,
      lastUpdate: new Date("2026-07-30"),
      nextAction: "متابعة نتائج فحص العينات",
      nextActionDate: new Date("2026-08-03"),
      managerApproval: "pending",
    },
    {
      taskNo: "PUR-003",
      name: "البحث عن موردي IC",
      description: "الحصول على دوائر متكاملة أصلية مع مقارنة السعر والمصدر",
      assignedDate: new Date("2026-07-01"),
      targetDate: new Date("2026-08-05"),
      ownerId: managers[0]._id,
      departmentId: departments[0]._id,
      assignedById: ceo._id,
      priority: "عالية",
      status: "بانتظار قرار الإدارة",
      progress: 0.6,
      lastUpdate: new Date("2026-07-30"),
      nextAction: "تحديد المورد المراد فحصه في شنتشن",
      nextActionDate: new Date("2026-08-01"),
      managementDecision: "قرار الشراء أو متابعة البحث",
      managerApproval: "pending",
    },
  ]);

  await DailyUpdate.insertMany([
    {
      updateNo: "UPD-001",
      taskId: tasks[0]._id,
      date: new Date("2026-05-25"),
      workPerformed: "بدء البحث عن موردي بطاريات UAV",
      result: "تم تحديد قائمة أولية من الموردين",
      nextAction: "التواصل وطلب البيانات الفنية",
      expectedDate: new Date("2026-05-26"),
      hours: 4,
      createdBy: iris._id,
    },
    {
      updateNo: "UPD-002",
      taskId: tasks[0]._id,
      date: new Date("2026-05-26"),
      workPerformed: "التواصل مع خمسة موردين",
      supplier: "عدة موردين",
      result: "استلام ردود أولية من ثلاثة موردين",
      nextAction: "طلب عروض الأسعار والعينات",
      expectedDate: new Date("2026-05-27"),
      hours: 7,
      createdBy: iris._id,
    },
    {
      updateNo: "UPD-003",
      taskId: tasks[1]._id,
      date: new Date("2026-07-30"),
      workPerformed: "متابعة موردَي الريليه",
      supplier: "Chen Tong / XIGI",
      result: "تم استلام عينات وبيانات فنية",
      issue: "انتظار نتائج الفحص",
      nextAction: "متابعة الفحص الفني",
      expectedDate: new Date("2026-08-03"),
      hours: 3,
      createdBy: iris._id,
    },
    {
      updateNo: "UPD-004",
      taskId: tasks[2]._id,
      date: new Date("2026-07-30"),
      workPerformed: "مراجعة عروض موردي IC",
      supplier: "3 موردين",
      result: "توفرت عروض أسعار أولية",
      issue: "الموردون يطلبون دفعًا قبل الفحص",
      nextAction: "طلب قرار الإدارة",
      expectedDate: new Date("2026-08-01"),
      hours: 2,
      createdBy: iris._id,
    },
  ]);

  await Supplier.insertMany([
    {
      taskId: tasks[0]._id,
      name: "Boltpower",
      product: "بطارية UAV 8000/10000mAh",
      currency: "RMB",
      sampleStatus: "تم الاستلام",
      rating: 8,
      decision: "قيد التقييم",
      reason: "تتوفر عينات وعرض سعر",
    },
    {
      taskId: tasks[0]._id,
      name: "Zhenghui",
      product: "بطارية UAV 8000/10000/18000mAh",
      currency: "RMB",
      sampleStatus: "تم الاستلام",
      rating: 8,
      decision: "قيد التقييم",
      reason: "تتوفر عينات وبيانات فنية",
    },
    {
      taskId: tasks[0]._id,
      name: "Grepow",
      product: "بطارية UAV 8000/10000/18000mAh",
      currency: "RMB",
      sampleStatus: "تم الشحن",
      rating: 9,
      decision: "قيد التقييم",
      reason: "شركة معروفة لكن السعر مرتفع",
    },
  ]);

  await SampleDocument.insertMany([
    {
      recordNo: "DOC-001",
      taskId: tasks[0]._id,
      supplier: "Boltpower",
      recordType: "ورقة مواصفات فنية",
      name: "Datasheet 8000mAh",
      requestDate: new Date("2026-05-27"),
      expectedDate: new Date("2026-05-28"),
      actualDate: new Date("2026-05-28"),
      status: "تم الاستلام",
      reviewResult: "تمت المراجعة",
    },
    {
      recordNo: "SMP-001",
      taskId: tasks[0]._id,
      supplier: "Boltpower",
      recordType: "صورة عينة",
      name: "عينة 8000mAh",
      requestDate: new Date("2026-05-30"),
      expectedDate: new Date("2026-06-10"),
      actualDate: new Date("2026-06-12"),
      status: "تم الاستلام",
      reviewResult: "بانتظار الفحص",
    },
    {
      recordNo: "DOC-002",
      taskId: tasks[1]._id,
      supplier: "XIGI Relay",
      recordType: "ورقة مواصفات فنية",
      name: "Relay Datasheet",
      requestDate: new Date("2026-07-20"),
      expectedDate: new Date("2026-07-22"),
      actualDate: new Date("2026-07-22"),
      status: "تم الاستلام",
      reviewResult: "تمت المراجعة",
    },
    {
      recordNo: "SMP-002",
      taskId: tasks[1]._id,
      supplier: "XIGI Relay",
      recordType: "صورة عينة",
      name: "2 pcs Relay samples",
      requestDate: new Date("2026-07-20"),
      expectedDate: new Date("2026-07-25"),
      actualDate: new Date("2026-07-25"),
      status: "تم الاستلام",
      reviewResult: "قيد الفحص",
    },
  ]);

  await Counter.insertMany([
    { _id: "task", seq: 3 },
    { _id: "update", seq: 4 },
    { _id: "doc", seq: 2 },
    { _id: "smp", seq: 2 },
  ]);

  console.log("Seed completed successfully");
  console.log(`\nDemo logins (password: ${SEED_PASSWORD}):`);
  console.log("  GM:       gm@alhadara.com");
  console.log("  CEO:      ceo@alhadara.com");
  console.log("  Manager: procurement@alhadara.com");
  console.log("  Employee: iris@alhadara.com");
  console.log(`  GM id: ${generalManager._id}`);
  console.log(`  CEO id: ${ceo._id}`);

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
