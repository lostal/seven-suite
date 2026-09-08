/**
 * Plantilla de Email: Confirmación de Reserva de Visitante
 *
 * Enviada al visitante externo al confirmar su plaza de aparcamiento.
 * Incluye botones de Google Calendar y Outlook; el .ics va adjunto.
 *
 * Paleta de colores alineada con el design system de la aplicación:
 *   - Primario:  #353f47 (pizarra oscura)
 *   - Acento:    #e8b765 (dorado)
 *   - Fondo:     #f3f5f6 (gris claro / muted)
 *   - Borde:     #dde1e3
 */

import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from "@/lib/email/components";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://sevensuite.app";

export interface VisitorReservationEmailProps {
  visitorName: string;
  visitorCompany: string;
  spotLabel: string;
  /** Fecha formateada en español, ej: "lunes, 21 de febrero de 2026" */
  date: string;
  reservedByName: string;
  notes?: string | null;
  googleCalendarUrl: string;
  outlookUrl: string;
}

export function VisitorReservationEmail({
  visitorName,
  spotLabel,
  date,
  reservedByName,
  notes,
  googleCalendarUrl,
  outlookUrl,
}: VisitorReservationEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>
        Plaza {spotLabel} reservada para el {date}
      </Preview>
      <Body style={s.body}>
        <Container style={s.container}>
          {/* Cabecera */}
          <Section style={s.header}>
            <Img
              src={`${APP_URL}/favicon-192x192.png`}
              alt="GRUPOSIETE"
              width={52}
              height={52}
              style={s.logoImg}
            />
            <Heading style={s.logo}>GRUPOSIETE</Heading>
            <Text style={s.tagline}>RESERVAS</Text>
          </Section>

          {/* Contenido principal */}
          <Section style={s.main}>
            <Heading as="h2" style={s.title}>
              Tu plaza está confirmada
            </Heading>
            <Text style={s.greeting}>
              Hola, <strong>{visitorName}</strong>
            </Text>
            <Text style={s.text}>
              <strong>{reservedByName}</strong> ha reservado una plaza de ha
              reservado una plaza de aparcamiento para tu visita a{" "}
              <strong>GRUPOSIETE</strong>.
            </Text>

            {/* Tarjeta de reserva (estilo ticket oscuro) */}
            <Section style={s.ticket}>
              <Row>
                <Column style={s.ticketLeft}>
                  <Text style={s.ticketLabel}>PLAZA</Text>
                  <Text style={s.ticketSpot}>{spotLabel}</Text>
                </Column>
                <Column style={s.ticketRight}>
                  <Text style={s.ticketLabel}>FECHA</Text>
                  <Text style={s.ticketDate}>{date}</Text>
                </Column>
              </Row>
            </Section>

            {notes && (
              <Section style={s.notes}>
                <Text style={s.notesLabel}>NOTAS</Text>
                <Text style={s.notesText}>{notes}</Text>
              </Section>
            )}

            {/* Añadir al calendario */}
            <Section style={s.calendarSection}>
              <Text style={s.calendarTitle}>
                Añade esta reserva a tu calendario
              </Text>
              <Row>
                <Column style={s.calendarColLeft}>
                  <Button href={googleCalendarUrl} style={s.btnPrimary}>
                    Google Calendar
                  </Button>
                </Column>
                <Column style={s.calendarColRight}>
                  <Button href={outlookUrl} style={s.btnOutline}>
                    Outlook
                  </Button>
                </Column>
              </Row>
              <Text style={s.icsNote}>
                También puedes abrir el archivo <strong>.ics</strong> adjunto
                con Apple Calendar, Thunderbird o cualquier otra app.
              </Text>
            </Section>
          </Section>

          <Hr style={s.hr} />

          {/* Pie */}
          <Section style={s.footer}>
            <Text style={s.footerText}>
              Para cualquier consulta, contacta con{" "}
              <strong>{reservedByName}</strong>.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ─── Estilos inline ───────────────────────────────────────────
// Colores del design system de la app (globals.css):
//   #353f47  →  primary (pizarra)
//   #4d5a63  →  secondary
//   #6a7881  →  muted-foreground
//   #e8b765  →  ring / acento dorado
//   #f3f5f6  →  muted (fondo suave)
//   #dde1e3  →  border

const s = {
  body: {
    backgroundColor: "#f3f5f6",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    margin: "0",
    padding: "0",
  },
  container: {
    maxWidth: "560px",
    margin: "32px auto",
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    overflow: "hidden" as const,
  },
  header: {
    backgroundColor: "#353f47",
    padding: "28px 40px",
    textAlign: "center" as const,
  },
  logoImg: {
    borderRadius: "12px",
    display: "block",
    margin: "0 auto 12px",
  },
  logo: {
    color: "#ffffff",
    fontSize: "24px",
    fontWeight: "800",
    margin: "0 0 6px",
    letterSpacing: "-0.3px",
  },
  tagline: {
    color: "#e8b765",
    fontSize: "10px",
    letterSpacing: "0.25em",
    textTransform: "uppercase" as const,
    margin: "0",
  },
  main: {
    padding: "36px 40px 28px",
  },
  title: {
    color: "#353f47",
    fontSize: "22px",
    fontWeight: "700",
    margin: "0 0 20px",
  },
  greeting: {
    color: "#4d5a63",
    fontSize: "16px",
    margin: "0 0 8px",
  },
  text: {
    color: "#6a7881",
    fontSize: "15px",
    lineHeight: "1.6",
    margin: "0 0 24px",
  },
  // Tarjeta oscura estilo ticket/boarding-pass
  ticket: {
    backgroundColor: "#353f47",
    borderRadius: "10px",
    padding: "20px 24px",
    marginBottom: "24px",
  },
  ticketLeft: {
    width: "50%",
    paddingRight: "20px",
    borderRight: "1px solid rgba(232, 183, 101, 0.25)",
  },
  ticketRight: {
    width: "50%",
    paddingLeft: "20px",
  },
  ticketLabel: {
    color: "#e8b765",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    margin: "0 0 6px",
  },
  ticketSpot: {
    color: "#ffffff",
    fontSize: "44px",
    fontWeight: "800",
    margin: "0",
    lineHeight: "1",
    letterSpacing: "-1px",
  },
  ticketDate: {
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "500",
    margin: "0",
    lineHeight: "1.6",
  },
  notes: {
    backgroundColor: "#f3f5f6",
    borderLeft: "3px solid #e8b765",
    padding: "12px 16px",
    marginBottom: "24px",
    borderRadius: "0 6px 6px 0",
  },
  notesLabel: {
    color: "#6a7881",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.1em",
    textTransform: "uppercase" as const,
    margin: "0 0 4px",
  },
  notesText: {
    color: "#353f47",
    fontSize: "14px",
    margin: "0",
    lineHeight: "1.5",
  },
  calendarSection: {
    borderTop: "1px solid #dde1e3",
    paddingTop: "20px",
    marginTop: "4px",
  },
  calendarTitle: {
    color: "#4d5a63",
    fontSize: "13px",
    fontWeight: "600",
    margin: "0 0 12px",
    textAlign: "center" as const,
  },
  calendarColLeft: {
    paddingRight: "6px",
    width: "50%",
  },
  calendarColRight: {
    paddingLeft: "6px",
    width: "50%",
  },
  btnPrimary: {
    backgroundColor: "#353f47",
    color: "#ffffff",
    padding: "10px 16px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "block",
    width: "100%",
    boxSizing: "border-box" as const,
  },
  btnOutline: {
    backgroundColor: "transparent",
    color: "#353f47",
    padding: "10px 16px",
    borderRadius: "8px",
    fontSize: "13px",
    fontWeight: "600",
    textDecoration: "none",
    textAlign: "center" as const,
    display: "block",
    width: "100%",
    boxSizing: "border-box" as const,
    border: "1.5px solid #dde1e3",
  },
  icsNote: {
    color: "#6a7881",
    fontSize: "12px",
    margin: "12px 0 0",
    textAlign: "center" as const,
    lineHeight: "1.5",
  },
  hr: {
    borderColor: "#dde1e3",
    margin: "0",
  },
  footer: {
    padding: "20px 40px",
    backgroundColor: "#f3f5f6",
  },
  footerText: {
    color: "#6a7881",
    fontSize: "13px",
    margin: "0",
    textAlign: "center" as const,
  },
};
