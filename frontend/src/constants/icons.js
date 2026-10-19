import {
  Baby, Book, Briefcase, Bus, Car, Coffee, Coins, Dumbbell, Film, Fuel, Gem, Gift, GraduationCap, HeartPulse, Home,
  Landmark, Laptop, MoreHorizontal, PawPrint, Plane, ShieldCheck, Shirt, ShoppingCart, Smartphone,
  Sofa, Tag, Utensils, Wifi, Wrench, Zap,
} from 'lucide-react';

/** Icons a user can choose for categories and goals (names are stored in the database). */
export const ICONS = {
  ShoppingCart, Home, Car, Utensils, HeartPulse, GraduationCap, Shirt, Smartphone, Briefcase, Landmark,
  Coins, Plane, ShieldCheck, Laptop, Gift, PawPrint, Dumbbell, Baby, Fuel, Zap, Wifi, Film, Book, Coffee,
  Bus, Wrench, Sofa, Gem, Tag, MoreHorizontal,
};

export const ICON_NAMES = Object.keys(ICONS);
// Goals saved before the piggy bank icon was replaced keep a matching icon
const RENAMED = { PiggyBank: Coins };

export const getIcon = (name) => ICONS[name] || RENAMED[name] || Tag;
