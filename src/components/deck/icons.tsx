import {
  Activity, AlertTriangle, Award, BarChart3, Boxes, Briefcase, Building2, Calendar, CheckCircle2, Clock, Cloud, Compass, Cpu,
  Database, DollarSign, Flag, Gauge, Globe, GraduationCap, Handshake, Heart, Layers, LineChart, Lock, Mail, Map, MessageSquare,
  Network, PieChart, Plug, Rocket, Search, Settings, ShieldAlert, ShieldCheck, ShoppingCart, Smartphone, Sparkles, Star, Target,
  TrendingDown, TrendingUp, Trophy, Truck, Users, Wallet, Wrench, Zap, Lightbulb, Leaf, Factory, Landmark, type LucideIcon,
} from "lucide-react";

/** Curated icon set the AI may reference by (kebab-case) lucide name. Unknown names fall back to Sparkles. */
const ICONS: Record<string, LucideIcon> = {
  activity: Activity, "alert-triangle": AlertTriangle, award: Award, "bar-chart": BarChart3, "bar-chart-3": BarChart3, boxes: Boxes,
  briefcase: Briefcase, "building-2": Building2, building: Building2, calendar: Calendar, "check-circle": CheckCircle2,
  "check-circle-2": CheckCircle2, clock: Clock, cloud: Cloud, compass: Compass, cpu: Cpu, database: Database,
  "dollar-sign": DollarSign, flag: Flag, gauge: Gauge, globe: Globe, "graduation-cap": GraduationCap, handshake: Handshake,
  heart: Heart, layers: Layers, "line-chart": LineChart, lock: Lock, mail: Mail, map: Map, "message-square": MessageSquare,
  network: Network, "pie-chart": PieChart, plug: Plug, rocket: Rocket, search: Search, settings: Settings,
  "shield-alert": ShieldAlert, "shield-check": ShieldCheck, shield: ShieldCheck, "shopping-cart": ShoppingCart, smartphone: Smartphone,
  sparkles: Sparkles, star: Star, target: Target, "trending-down": TrendingDown, "trending-up": TrendingUp, trophy: Trophy,
  truck: Truck, users: Users, wallet: Wallet, wrench: Wrench, zap: Zap, lightbulb: Lightbulb, leaf: Leaf, factory: Factory,
  landmark: Landmark, bank: Landmark,
};

export function DeckIcon({ name, className, style }: { name: string; className?: string; style?: React.CSSProperties }) {
  const key = name.toLowerCase().replace(/([a-z])([A-Z])/g, "$1-$2").replace(/_/g, "-");
  const Icon = ICONS[key] ?? Sparkles;
  return <Icon className={className} style={style} />;
}

export const ICON_NAMES = Object.keys(ICONS);
