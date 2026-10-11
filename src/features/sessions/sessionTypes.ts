// ─── SESSION / BOOKING TYPES ───
// App aur backend (functions/src/bookings/) dono jagah in shapes ko
// match karna — kisi ek jagah field add/remove karo to dusri jagah bhi
// update karo.

export interface Teacher {
  id: string;
  name: string;
  email: string; // 🎯 ZAROORI: teacher ka login email, admins collection wali email se match karta hona chahiye
  photoUrl?: string;
  bio?: string;
  specialization: string; // e.g. "IELTS Speaking Coach"
  pricePerSession: number; // rupees
  sessionDurationMins: number; // e.g. 30
  languages?: string[];
  rating?: number;
}

export interface TimeSlot {
  id: string;
  teacherId: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "18:00"
  endTime: string; // "18:30"
  isBooked: boolean;
  // 🆕 Admin slot banate waqt price set karta hai (rupees). Purane slots me
  // ye field nahi hoga — tab teacher.pricePerSession fallback hota hai.
  price?: number;
}

export type BookingStatus = 'pending_payment' | 'confirmed' | 'cancelled';

export interface Booking {
  id: string;
  studentId: string;
  teacherId: string;
  teacherName: string;
  teacherEmail: string; // 🎯 teacher-side "meri sessions" query isی field se hoti hai
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
  status: BookingStatus;
  paymentId?: string;
  roomId?: string; // LiveKit room id — video session ke liye
  kind?: 'demo' | 'subscription'; // demo class / session paid through a Video plan; normal paid booking has none
  createdAt?: any;
}

// ─── createBooking() Cloud Function ka input/output ───
export interface CreateBookingParams {
  teacherId: string;
  slotId: string;
}

export interface CreateBookingResponse {
  bookingId: string;
  teacherId: string;
  teacherName: string;
  date: string;
  startTime: string;
  endTime: string;
  price: number;
  status?: BookingStatus; // demo class free ho to 'confirmed' aata hai
  kind?: 'demo';
}