import dennisImg from "@/app/assets/experts/dennis.png?url";
import robinImg from "@/app/assets/experts/robin.png?url";
import laraImg from "@/app/assets/experts/lara.png?url";

export interface IExpert {
  id: string;
  name: string;
  image: string;
}

export const EXPERTS: IExpert[] = [
  { id: "dennis", name: "Dennis", image: dennisImg },
  { id: "robin", name: "Robin", image: robinImg },
  { id: "lara", name: "Lara", image: laraImg },
];

export const EXPERTS_BY_ID: Record<string, IExpert> = Object.fromEntries(EXPERTS.map((e) => [e.id, e]));
