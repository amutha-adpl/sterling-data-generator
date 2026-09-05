/**
 * Indian reference data used for sample customers.
 *
 * Faker's `en_IND` locale falls back to US address/name data, so the pools the
 * generator needs are defined here instead. City, state and PIN code are kept
 * together so a generated address is always internally consistent.
 */

export interface IndiaLocation {
  city: string;
  state: string;
  /** Real 6-digit PIN code for the city. */
  pinCode: string;
}

export const INDIA_LOCATIONS: readonly IndiaLocation[] = [
  { city: 'Mumbai', state: 'Maharashtra', pinCode: '400001' },
  { city: 'Pune', state: 'Maharashtra', pinCode: '411001' },
  { city: 'Nagpur', state: 'Maharashtra', pinCode: '440001' },
  { city: 'Nashik', state: 'Maharashtra', pinCode: '422001' },
  { city: 'Chennai', state: 'Tamil Nadu', pinCode: '600001' },
  { city: 'Coimbatore', state: 'Tamil Nadu', pinCode: '641001' },
  { city: 'Madurai', state: 'Tamil Nadu', pinCode: '625001' },
  { city: 'Tirunelveli', state: 'Tamil Nadu', pinCode: '627001' },
  { city: 'Tiruchirappalli', state: 'Tamil Nadu', pinCode: '620001' },
  { city: 'Salem', state: 'Tamil Nadu', pinCode: '636001' },
  { city: 'Bengaluru', state: 'Karnataka', pinCode: '560001' },
  { city: 'Mysuru', state: 'Karnataka', pinCode: '570001' },
  { city: 'Hyderabad', state: 'Telangana', pinCode: '500001' },
  { city: 'New Delhi', state: 'Delhi', pinCode: '110001' },
  { city: 'Noida', state: 'Uttar Pradesh', pinCode: '201301' },
  { city: 'Lucknow', state: 'Uttar Pradesh', pinCode: '226001' },
  { city: 'Jaipur', state: 'Rajasthan', pinCode: '302001' },
  { city: 'Ahmedabad', state: 'Gujarat', pinCode: '380001' },
  { city: 'Surat', state: 'Gujarat', pinCode: '395001' },
  { city: 'Kolkata', state: 'West Bengal', pinCode: '700001' },
  { city: 'Kochi', state: 'Kerala', pinCode: '682001' },
  { city: 'Thiruvananthapuram', state: 'Kerala', pinCode: '695001' },
  { city: 'Bhubaneswar', state: 'Odisha', pinCode: '751001' },
  { city: 'Guwahati', state: 'Assam', pinCode: '781001' },
  { city: 'Indore', state: 'Madhya Pradesh', pinCode: '452001' },
  { city: 'Chandigarh', state: 'Chandigarh', pinCode: '160001' },
  { city: 'Gurugram', state: 'Haryana', pinCode: '122001' },
  { city: 'Vijayawada', state: 'Andhra Pradesh', pinCode: '520001' },
];

export const INDIA_STREETS: readonly string[] = [
  'MG Road',
  'Anna Salai',
  'Brigade Road',
  'Gandhi Road',
  'Nehru Street',
  'Station Road',
  'Bazaar Road',
  'Temple Street',
  'Lake View Road',
  'Ring Road',
  'Cross Cut Road',
  'Residency Road',
  'Commercial Street',
  'Sardar Patel Road',
  'Rajaji Salai',
  'Link Road',
  'Park Street',
  'Mount Road',
  'Hospital Road',
  'School Street',
];

export const INDIA_FIRST_NAMES: readonly string[] = [
  'Amutha', 'Arun', 'Priya', 'Karthik', 'Lakshmi', 'Ramesh', 'Suresh', 'Meena',
  'Anand', 'Divya', 'Vijay', 'Sunita', 'Rajesh', 'Kavitha', 'Manoj', 'Deepa',
  'Senthil', 'Revathi', 'Ganesh', 'Nithya', 'Saravanan', 'Anitha', 'Prakash',
  'Vandana', 'Rahul', 'Sneha', 'Aditya', 'Pooja', 'Krishnan', 'Meera',
  'Venkatesan', 'Shanthi', 'Mohan', 'Geetha', 'Sundar', 'Radha',
];

export const INDIA_LAST_NAMES: readonly string[] = [
  'K', 'Kumar', 'Sharma', 'Iyer', 'Nair', 'Reddy', 'Rao', 'Menon', 'Pillai',
  'Das', 'Bose', 'Ghosh', 'Patil', 'Desai', 'Joshi', 'Singh', 'Yadav', 'Gupta',
  'Mehta', 'Chatterjee', 'Krishnan', 'Venkatesan', 'Subramanian', 'Raman',
  'Nadar', 'Thevar', 'Muthiah', 'Balakrishnan', 'Chandra', 'Verma',
];