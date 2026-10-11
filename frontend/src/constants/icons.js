import {
  Baby, Book, Briefcase, Bus, Car, Coffee, Dumbbell, Film, Fuel, Gem, Gift, GraduationCap, HeartPulse, Home,
  Landmark, Laptop, MoreHorizontal, PawPrint, PiggyBank, Plane, ShieldCheck, Shirt, ShoppingCart, Smartphone,
  Sofa, Tag, Utensils, Wifi, Wrench, Zap,
} from 'lucide-react';

/** Icons a user can choose for categories and goals (names are stored in the database). */
export const ICONS = {
  ShoppingCart, Home, Car, Utensils, HeartPulse, GraduationCap, Shirt, Smartphone, Briefcase, Landmark,
  PiggyBank, Plane, ShieldCheck, Laptop, Gift, PawPrint, Dumbbell, Baby, Fuel, Zap, Wifi, Film, Book, Coffee,
  Bus, Wrench, Sofa, Gem, Tag, MoreHorizontal,
};

export const ICON_NAMES = Object.keys(ICONS);
export const getIcon = (name) => ICONS[name] || Tag;
