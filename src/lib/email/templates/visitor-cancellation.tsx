/**
 * Plantilla de Email: Cancelación de Reserva de Visitante
 *
 * Enviada al visitante cuando su reserva de aparcamiento es cancelada.
 * El .ics adjunto usa METHOD:CANCEL para eliminar el evento del calendario.
 */

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from "@/lib/email/components";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://sevensuite.app";

export interface VisitorCancellationEmailProps {
  visitorName: string;
  spotLabel: string;
  /** Fecha formateada en español, ej: "lunes, 21 de febrero de 2026" */
  date: string;
  cancelledByName: string;
}

export function VisitorCancellationEmail({
  visitorName,
  spotLabel,
  date,
  cancelledByName,
}: VisitorCancellationEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Reserva de plaza cancelada — {date}</Preview>
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

          {/* Contenido */}
          <Section style={s.main}>
            <Heading as="h2" style={s.title}>
              Reserva cancelada
            </Heading>
            <Text style={s.greeting}>
              Hola, <strong>{visitorName}</strong>
            </Text>
            <Text style={s.text}>
              <strong>{cancelledByName}</strong> ha cancelado tu reserva de
              plaza de aparcamiento en GRUPOSIETE.
            </Text>

            {/* Tarjeta de la reserva cancelada */}
            <Section style={s.ticket}>
              <Text style={s.ticketLabel}>PLAZA CANCELADA</Text>
              <Text style={s.ticketSpot}>{spotLabel}</Text>
              <Text style={s.ticketDate}>{date}</Text>
            </Section>

            <Text style={s.icsNote}>
              Si habías añadido esta reserva a tu calendario, el archivo adjunto
              la eliminará automáticamente al abrirlo.
            </Text>
          </Section>

          <Hr style={s.hr} />

          {/* Pie */}
          <Section style={s.footer}>
            <Text style={s.footerText}>
              Para cualquier consulta, contacta con{" "}
              <strong>{cancelledByName}</strong>.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ─── Estilos inline ───────────────────────────────────────────

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
  ticket: {
    backgroundColor: "#f3f5f6",
    borderRadius: "10px",
    padding: "20px 24px",
    marginBottom: "20px",
    borderLeft: "4px solid #6a7881",
  },
  ticketLabel: {
    color: "#6a7881",
    fontSize: "10px",
    fontWeight: "700",
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    margin: "0 0 8px",
  },
  ticketSpot: {
    color: "#353f47",
    fontSize: "36px",
    fontWeight: "800",
    margin: "0 0 4px",
    lineHeight: "1",
    letterSpacing: "-0.5px",
    textDecoration: "line-through",
  },
  ticketDate: {
    color: "#6a7881",
    fontSize: "14px",
    fontWeight: "500",
    margin: "0",
  },
  icsNote: {
    color: "#6a7881",
    fontSize: "13px",
    lineHeight: "1.6",
    margin: "0",
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
