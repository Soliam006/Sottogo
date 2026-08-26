/**
 * Iconografia de Voyago.
 *
 * Un unico sitio donde vive el set de iconos. El resto de la app importa de
 * aqui y nunca de `@phosphor-icons/react` directamente: cambiar de familia,
 * de icono o de grosor se hace en este fichero.
 *
 * Importamos por ruta profunda (`dist/ssr/<Nombre>`) por dos motivos:
 *   - la variante `ssr` funciona igual en Server y Client Components;
 *   - evita arrastrar el barril de 3.000 iconos al bundle.
 *
 * Grosores, para que la app tenga una voz coherente:
 *   fill     -> iconos con peso: navegacion activa, categorias, marcadores.
 *   regular  -> navegacion inactiva y acciones secundarias.
 *   duotone  -> ilustracion: estados vacios y cabeceras grandes.
 */

import { AirplaneTakeoffIcon } from "@phosphor-icons/react/dist/ssr/AirplaneTakeoff";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/ssr/ArrowLeft";
import { BarcodeIcon } from "@phosphor-icons/react/dist/ssr/Barcode";
import { BedIcon } from "@phosphor-icons/react/dist/ssr/Bed";
import { BellIcon } from "@phosphor-icons/react/dist/ssr/Bell";
import { BuildingsIcon } from "@phosphor-icons/react/dist/ssr/Buildings";
import { CalendarBlankIcon } from "@phosphor-icons/react/dist/ssr/CalendarBlank";
import { CameraIcon } from "@phosphor-icons/react/dist/ssr/Camera";
import { CaretLeftIcon } from "@phosphor-icons/react/dist/ssr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr/CaretRight";
import { ChatCircleIcon } from "@phosphor-icons/react/dist/ssr/ChatCircle";
import { CarIcon } from "@phosphor-icons/react/dist/ssr/Car";
import { CheckIcon as PhCheck } from "@phosphor-icons/react/dist/ssr/Check";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { ClipboardTextIcon } from "@phosphor-icons/react/dist/ssr/ClipboardText";
import { CoffeeIcon } from "@phosphor-icons/react/dist/ssr/Coffee";
import { CompassIcon } from "@phosphor-icons/react/dist/ssr/Compass";
import { CrosshairIcon } from "@phosphor-icons/react/dist/ssr/Crosshair";
import { DotsThreeIcon } from "@phosphor-icons/react/dist/ssr/DotsThree";
import { FlowerIcon } from "@phosphor-icons/react/dist/ssr/Flower";
import { ForkKnifeIcon } from "@phosphor-icons/react/dist/ssr/ForkKnife";
import { GameControllerIcon } from "@phosphor-icons/react/dist/ssr/GameController";
import { GearIcon } from "@phosphor-icons/react/dist/ssr/Gear";
import { GiftIcon } from "@phosphor-icons/react/dist/ssr/Gift";
import { GlobeIcon as PhGlobe } from "@phosphor-icons/react/dist/ssr/Globe";
import { HeartIcon } from "@phosphor-icons/react/dist/ssr/Heart";
import { HouseIcon } from "@phosphor-icons/react/dist/ssr/House";
import { ImageIcon as PhImage } from "@phosphor-icons/react/dist/ssr/Image";
import { ImagesIcon } from "@phosphor-icons/react/dist/ssr/Images";
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";
import { MapPinIcon } from "@phosphor-icons/react/dist/ssr/MapPin";
import { MapTrifoldIcon } from "@phosphor-icons/react/dist/ssr/MapTrifold";
import { MedalIcon } from "@phosphor-icons/react/dist/ssr/Medal";
import { MountainsIcon } from "@phosphor-icons/react/dist/ssr/Mountains";
import { PackageIcon } from "@phosphor-icons/react/dist/ssr/Package";
import { PaperclipIcon } from "@phosphor-icons/react/dist/ssr/Paperclip";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";
import { PushPinIcon } from "@phosphor-icons/react/dist/ssr/PushPin";
import { ShareNetworkIcon } from "@phosphor-icons/react/dist/ssr/ShareNetwork";
import { ShoppingBagIcon } from "@phosphor-icons/react/dist/ssr/ShoppingBag";
import { SignpostIcon } from "@phosphor-icons/react/dist/ssr/Signpost";
import { SparkleIcon } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { StarIcon as PhStar } from "@phosphor-icons/react/dist/ssr/Star";
import { SuitcaseRollingIcon } from "@phosphor-icons/react/dist/ssr/SuitcaseRolling";
import { TicketIcon } from "@phosphor-icons/react/dist/ssr/Ticket";
import { TrainIcon } from "@phosphor-icons/react/dist/ssr/Train";
import { TrashIcon } from "@phosphor-icons/react/dist/ssr/Trash";
import { TrophyIcon } from "@phosphor-icons/react/dist/ssr/Trophy";
import { WalletIcon } from "@phosphor-icons/react/dist/ssr/Wallet";
import { WarningIcon as PhWarning } from "@phosphor-icons/react/dist/ssr/Warning";
import { XIcon } from "@phosphor-icons/react/dist/ssr/X";

export type { Icon, IconProps, IconWeight } from "@phosphor-icons/react/dist/lib/types";

// --- Navegacion y estructura ------------------------------------------------
export const HomeIcon = HouseIcon;
export const MapIcon = MapTrifoldIcon;
export const ItineraryIcon = CalendarBlankIcon;
export const PlaceIcon = MapPinIcon;
export const ExpenseIcon = WalletIcon;
export const GalleryIcon = ImagesIcon;
export const MomentIcon = SparkleIcon;
export const SummaryIcon = TrophyIcon;
export const ChecklistIcon = SuitcaseRollingIcon;
export const SettingsIcon = GearIcon;
export const BrandIcon = CompassIcon;

// --- Acciones ---------------------------------------------------------------
export const CloseIcon = XIcon;
export const CheckIcon = PhCheck;
export const VisitedIcon = CheckCircleIcon;
export const DeleteIcon = TrashIcon;
export const AddIcon = PlusIcon;
export const BackIcon = ArrowLeftIcon;
export const SearchIcon = MagnifyingGlassIcon;
export const AttachIcon = PaperclipIcon;
export const LocateIcon = CrosshairIcon;
export const PinIcon = PushPinIcon;
export const NotificationIcon = BellIcon;
export const CommentIcon = ChatCircleIcon;
export const ShareIcon = ShareNetworkIcon;
export const MoreIcon = DotsThreeIcon;
export const PrevIcon = CaretLeftIcon;
export const NextIcon = CaretRightIcon;

// --- Preparacion del viaje --------------------------------------------------
export const FlightIcon = AirplaneTakeoffIcon;
export const StayIcon = BuildingsIcon;
export const CarRentalIcon = CarIcon;
export const OtherPrepIcon = ClipboardTextIcon;
export const ReferenceIcon = BarcodeIcon;

// --- Contenido --------------------------------------------------------------
export const PhotoIcon = CameraIcon;
export const ImageIcon = PhImage;
export const StarIcon = PhStar;
export const FavouriteIcon = HeartIcon;
export const MedalAwardIcon = MedalIcon;
export const GlobeIcon = PhGlobe;
export const WarningIcon = PhWarning;
export const TripIcon = SuitcaseRollingIcon;

// --- Categorias de gasto y opciones de itinerario ---------------------------
export {
  BedIcon,
  CoffeeIcon,
  FlowerIcon,
  ForkKnifeIcon,
  GameControllerIcon,
  GiftIcon,
  MountainsIcon,
  PackageIcon,
  ShoppingBagIcon,
  SignpostIcon,
  TicketIcon,
  TrainIcon,
};
