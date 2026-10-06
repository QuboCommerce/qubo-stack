import {
  ArrowRight, Award, BadgeCheck, Calendar, Check, CircleCheck, Clock, CreditCard, Download, Droplets, Factory, Fan,
  Flame, Gauge, Gift, Globe, Heart, HeartHandshake, House, Leaf, Lightbulb, Lock, Mail, MapPin, MessageCircle,
  Package, Phone, Plug, Quote, Recycle, Rocket, Ruler, Scissors, Settings, Shield, ShieldCheck, ShoppingBag,
  ShoppingCart, Smile, Snowflake, Sparkles, Star, Sun, Thermometer, ThumbsUp, Timer, Truck, User, Users, Wind,
  Wrench, Zap, Plus, Minus, X, Navigation, ChevronDown, ChevronRight, ArrowUpRight, Instagram, Facebook, Linkedin,
  Youtube, Search, Menu, Bike, BatteryCharging, Flower2, Dumbbell, Sparkle, Building2, Hammer,
  Beef, ChefHat, Croissant, FileText, Camera, Calculator, Dot, Refrigerator, Utensils, Scale, CookingPot, Store, Microwave,
  type LucideIcon, type LucideProps,
} from "lucide-react";

/**
 * Curated icon set (named imports keep bundles small). Stored in documents by
 * kebab-case name so the set can grow without migrations.
 */
export const iconSet: Record<string, LucideIcon> = {
  "arrow-right": ArrowRight, award: Award, "badge-check": BadgeCheck, calendar: Calendar, check: Check,
  "circle-check": CircleCheck, clock: Clock, "credit-card": CreditCard, download: Download, droplets: Droplets,
  factory: Factory, fan: Fan, flame: Flame, gauge: Gauge, gift: Gift, globe: Globe, heart: Heart,
  "heart-handshake": HeartHandshake, house: House, leaf: Leaf, lightbulb: Lightbulb, lock: Lock, mail: Mail,
  "map-pin": MapPin, "message-circle": MessageCircle, package: Package, phone: Phone, plug: Plug, quote: Quote,
  recycle: Recycle, rocket: Rocket, ruler: Ruler, scissors: Scissors, settings: Settings, shield: Shield,
  "shield-check": ShieldCheck, "shopping-bag": ShoppingBag, "shopping-cart": ShoppingCart, smile: Smile,
  snowflake: Snowflake, sparkles: Sparkles, star: Star, sun: Sun, thermometer: Thermometer, "thumbs-up": ThumbsUp,
  timer: Timer, truck: Truck, user: User, users: Users, wind: Wind, wrench: Wrench, zap: Zap,
  plus: Plus, minus: Minus, x: X, navigation: Navigation, "chevron-down": ChevronDown, "chevron-right": ChevronRight,
  "arrow-up-right": ArrowUpRight, instagram: Instagram, facebook: Facebook, linkedin: Linkedin, youtube: Youtube,
  bike: Bike, "battery-charging": BatteryCharging, flower: Flower2, dumbbell: Dumbbell, sparkle: Sparkle,
  building: Building2, hammer: Hammer, search: Search, menu: Menu,
  beef: Beef, "chef-hat": ChefHat, croissant: Croissant, "file-text": FileText, camera: Camera, calculator: Calculator,
  dot: Dot, refrigerator: Refrigerator, utensils: Utensils, scale: Scale, "cooking-pot": CookingPot, store: Store, microwave: Microwave,
};

export const iconNames = Object.keys(iconSet);

export function IconGlyph({ name, ...props }: { name: string } & LucideProps) {
  const Glyph = iconSet[name];
  if (!Glyph) return null;
  return <Glyph aria-hidden="true" {...props} />;
}
