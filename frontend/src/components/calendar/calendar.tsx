import { Calendar as CalendarPrime } from "primereact/calendar";
import { FormEvent } from "primereact/ts-helpers";
import { locale, addLocale } from "primereact/api";
import React, { useEffect } from "react";
import "./calendar.scss";
import { useI18n } from "../../i18n/use-i18n";

export type CalendarChangeEvent = FormEvent<Date>;

export type CalendarProps = {
  id?: string;
  label?: string;
  value: Date | null;
  onChange: (e: CalendarChangeEvent) => void;
  showIcon?: boolean;
  dateFormat?: string;
  showTime?: boolean;
  hourFormat?: "12" | "24";
  showButtonBar?: boolean;
  minDate?: Date;
  inputClassName?: string;
  className?: string;
};

export default function Calendar(props: CalendarProps) {
  const { locale: currentLocale } = useI18n();

  useEffect(() => {
    // Configura i giorni per far iniziare la settimana di lunedì (firstDayOfWeek = 1)
    addLocale("it", {
      firstDayOfWeek: 1,
      dayNames: [
        "Domenica",
        "Lunedì",
        "Martedì",
        "Mercoledì",
        "Giovedì",
        "Venerdì",
        "Sabato",
      ],
      dayNamesShort: ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"],
      dayNamesMin: ["Do", "Lu", "Ma", "Me", "Gi", "Ve", "Sa"],
      monthNames: [
        "Gennaio",
        "Febbraio",
        "Marzo",
        "Aprile",
        "Maggio",
        "Giugno",
        "Luglio",
        "Agosto",
        "Settembre",
        "Ottobre",
        "Novembre",
        "Dicembre",
      ],
      monthNamesShort: [
        "Gen",
        "Feb",
        "Mar",
        "Apr",
        "Mag",
        "Giu",
        "Lug",
        "Ago",
        "Set",
        "Ott",
        "Nov",
        "Dic",
      ],
      today: "Oggi",
      clear: "Cancella",
    });

    addLocale("en", {
      firstDayOfWeek: 1,
      dayNames: [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
      dayNamesMin: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
      monthNames: [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ],
      monthNamesShort: [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
      ],
      today: "Today",
      clear: "Clear",
    });

    locale(currentLocale);
  }, [currentLocale]);

  return (
    <div className={`div-calendar ${props.className ?? ""}`}>
      {props.label && <label className="field-label">{props.label}</label>}
      <CalendarPrime
        id={props.id}
        value={props.value}
        onChange={props.onChange}
        showIcon={props.showIcon}
        dateFormat={props.dateFormat ?? "dd/mm/yy"}
        showTime={props.showTime}
        hourFormat={props.hourFormat}
        showButtonBar={props.showButtonBar}
        minDate={props.minDate}
        inputClassName={props.inputClassName}
      />
    </div>
  );
}
