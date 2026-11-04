package main

// Entrar con el correo, sin contrasena. La persona escribe su correo, le llega un enlace que
// sirve una vez y vence en 30 minutos, y al abrirlo su racha queda guardada en esa cuenta.
// El correo sale por el SMTP de ledkid.com, con su contrasena de aplicacion de Gmail.

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"html"
	"log"
	"mime"
	"net"
	"net/http"
	"net/smtp"
	"strings"
	"time"
)

type pedidoCorreo struct {
	Correo string `json:"correo"`
}

func (s *Srv) pedirEnlace(w http.ResponseWriter, r *http.Request, lector string) {
	var p pedidoCorreo
	if !leerJSON(w, r, &p) {
		return
	}
	correo := strings.ToLower(strings.TrimSpace(p.Correo))
	if !correoValido.MatchString(correo) || len(correo) > 120 {
		fallo(w, 400, "Ese correo no parece válido")
		return
	}
	if !s.limites.deja("correo-ip:"+ipDe(r), 0.02, 25) || !s.limites.deja("correo:"+correo, 0.003, 2) {
		fallo(w, 429, "Ya te mandamos un enlace, revisa tu correo o espera unos minutos")
		return
	}
	crudo, valor := tokenNuevo()
	ctx := r.Context()
	if _, err := s.db.Exec(ctx, `INSERT INTO enlaces (token, correo, lector, expira) VALUES ($1,$2,$3, now() + interval '30 minutes')`,
		hashToken(crudo), correo, lector); err != nil {
		fallo(w, 500, "no pude crear el enlace")
		return
	}
	enlace := s.cfg.URLPublica + "/entrar?t=" + valor
	if !s.cfg.correoListo() {
		log.Printf("correo apagado, enlace para %s %s", tapar(correo), enlace)
		responder(w, 200, map[string]any{"ok": true, "modo": "local"})
		return
	}
	go func() {
		asunto := "Tu enlace para entrar a lectortie"
		cuerpo := plantilla("Guarda tu racha",
			"Toca el botón para entrar a lectortie con este correo. Tu racha, tus páginas y tu gusto quedan guardados aunque cambies de teléfono.",
			"Entrar a lectortie", enlace,
			"El enlace sirve una vez y vence en 30 minutos. Si no lo pediste, ignora este correo.")
		if err := s.enviar(correo, asunto, cuerpo); err != nil {
			log.Printf("correo a %s: %v", tapar(correo), err)
		}
	}()
	responder(w, 200, map[string]any{"ok": true, "modo": "correo"})
}

func (s *Srv) entrarConEnlace(w http.ResponseWriter, r *http.Request) {
	crudo, err := base64.RawURLEncoding.DecodeString(r.URL.Query().Get("t"))
	if err != nil || len(crudo) != 32 {
		http.Redirect(w, r, "/?entrada=mal", http.StatusSeeOther)
		return
	}
	ctx := r.Context()
	tx, err := s.db.Begin(ctx)
	if err != nil {
		http.Redirect(w, r, "/?entrada=mal", http.StatusSeeOther)
		return
	}
	defer tx.Rollback(ctx)
	var correo, lector string
	err = tx.QueryRow(ctx, `UPDATE enlaces SET usado = now() WHERE token = $1 AND usado IS NULL AND expira > now()
		RETURNING correo, lector::text`, hashToken(crudo)).Scan(&correo, &lector)
	if err != nil {
		http.Redirect(w, r, "/?entrada=vencido", http.StatusSeeOther)
		return
	}
	// si el correo ya era de otro lector, se entra a esa cuenta; si no, se guarda en este
	var dueno string
	nuevo := false
	if err := tx.QueryRow(ctx, `SELECT id::text FROM lectores WHERE lower(correo) = $1`, correo).Scan(&dueno); err != nil {
		if _, err := tx.Exec(ctx, `UPDATE lectores SET correo = $2 WHERE id = $1`, lector, correo); err != nil {
			http.Redirect(w, r, "/?entrada=mal", http.StatusSeeOther)
			return
		}
		dueno = lector
		nuevo = true
	}
	if err := tx.Commit(ctx); err != nil {
		http.Redirect(w, r, "/?entrada=mal", http.StatusSeeOther)
		return
	}
	if err := s.abrirSesion(ctx, w, r, dueno); err != nil {
		http.Redirect(w, r, "/?entrada=mal", http.StatusSeeOther)
		return
	}
	if nuevo && s.cfg.correoListo() {
		go func() {
			cuerpo := plantilla("Tu racha quedó guardada",
				"Ya puedes entrar a lectortie desde cualquier teléfono con este correo. Cada día que termines una lectura se prende tu racha.",
				"Seguir leyendo", s.cfg.URLPublica,
				"Sin anuncios y sin contraseña. Cuando quieras volver a entrar, pide otro enlace.")
			if err := s.enviar(correo, "Bienvenida a lectortie", cuerpo); err != nil {
				log.Printf("correo de bienvenida a %s: %v", tapar(correo), err)
			}
		}()
	}
	http.Redirect(w, r, "/?entrada=ok", http.StatusSeeOther)
}

// enviar manda un correo HTML por el SMTP de ledkid, con STARTTLS en el 587 o TLS en el 465.
func (s *Srv) enviar(para, asunto, cuerpo string) error {
	host, puerto, _ := net.SplitHostPort(s.cfg.SMTPHost)
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	var conn net.Conn
	var err error
	d := &net.Dialer{Timeout: 15 * time.Second}
	tc := &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}
	if puerto == "465" {
		conn, err = tls.DialWithDialer(d, "tcp", s.cfg.SMTPHost, tc)
	} else {
		conn, err = d.DialContext(ctx, "tcp", s.cfg.SMTPHost)
	}
	if err != nil {
		return err
	}
	conn.SetDeadline(time.Now().Add(30 * time.Second))
	c, err := smtp.NewClient(conn, host)
	if err != nil {
		conn.Close()
		return err
	}
	defer c.Close()
	if puerto != "465" {
		if err := c.StartTLS(tc); err != nil {
			return err
		}
	}
	if err := c.Auth(smtp.PlainAuth("", s.cfg.SMTPUser, s.cfg.SMTPPass, host)); err != nil {
		return fmt.Errorf("autenticar: %w", err)
	}
	if err := c.Mail(s.cfg.SMTPUser); err != nil {
		return err
	}
	if err := c.Rcpt(para); err != nil {
		return err
	}
	wc, err := c.Data()
	if err != nil {
		return err
	}
	msg := "From: " + mime.QEncoding.Encode("utf-8", "lectortie") + " <" + s.cfg.SMTPUser + ">\r\n" +
		"To: <" + para + ">\r\n" +
		"Subject: " + mime.QEncoding.Encode("utf-8", asunto) + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/html; charset=utf-8\r\n" +
		"Content-Transfer-Encoding: base64\r\n" +
		"Date: " + time.Now().Format(time.RFC1123Z) + "\r\n\r\n" +
		partir76(base64.StdEncoding.EncodeToString([]byte(cuerpo)))
	if _, err := wc.Write([]byte(msg)); err != nil {
		return err
	}
	if err := wc.Close(); err != nil {
		return err
	}
	return c.Quit()
}

func partir76(s string) string {
	var b strings.Builder
	for len(s) > 76 {
		b.WriteString(s[:76] + "\r\n")
		s = s[76:]
	}
	b.WriteString(s + "\r\n")
	return b.String()
}

func plantilla(titulo, texto, boton, enlace, pie string) string {
	e := html.EscapeString
	return `<!doctype html><html lang="es"><body style="margin:0;background:#0A0912;font-family:Segoe UI,Arial,sans-serif;color:#F4F2FA">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0912;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#141221;border-radius:24px;padding:36px 32px;border:1px solid #2A2640">
<tr><td style="font-size:30px;font-weight:800;letter-spacing:-1px;color:#F4F2FA">lector<span style="color:#8B6BFF">tie</span></td></tr>
<tr><td style="padding-top:26px;font-size:26px;font-weight:800;color:#F4F2FA">` + e(titulo) + `</td></tr>
<tr><td style="padding-top:12px;font-size:16px;line-height:1.55;color:#C9C4DE">` + e(texto) + `</td></tr>
<tr><td style="padding-top:26px"><a href="` + e(enlace) + `" style="display:inline-block;background:#2AE58C;color:#0A0912;text-decoration:none;font-weight:800;font-size:17px;padding:15px 26px;border-radius:999px">` + e(boton) + `</a></td></tr>
<tr><td style="padding-top:26px;font-size:13px;line-height:1.5;color:#9A95B4">` + e(pie) + `</td></tr>
</table>
<p style="font-size:12px;color:#5A5577;margin-top:18px">lectortie, que cada scroll termine en un libro</p>
</td></tr></table></body></html>`
}
