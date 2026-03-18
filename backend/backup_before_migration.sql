--
-- PostgreSQL database dump
--

\restrict BvrsjnLk8CIXTYkjbnwVsdz9UluzFwT1zmcfvzu7sXfG52viFnbnKJ8hmTW87EU

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN NEW."updatedAt" = NOW(); RETURN NEW; END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: AssignmentRequest; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AssignmentRequest" (
    id integer NOT NULL,
    "requestType" text NOT NULL,
    "deviceId" integer,
    "setId" integer,
    "clientId" integer NOT NULL,
    "healthStatus" text DEFAULT 'ok'::text NOT NULL,
    "healthComment" text,
    "returnType" text NOT NULL,
    "returnDays" integer,
    "returnMonths" integer,
    "returnDate" timestamp(3) without time zone,
    "computedReturnDate" timestamp(3) without time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    "requestedBy" integer,
    "approvedBy" integer,
    "approvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."AssignmentRequest" OWNER TO postgres;

--
-- Name: AssignmentRequest_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."AssignmentRequest_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."AssignmentRequest_id_seq" OWNER TO postgres;

--
-- Name: AssignmentRequest_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."AssignmentRequest_id_seq" OWNED BY public."AssignmentRequest".id;


--
-- Name: Client; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Client" (
    id integer NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    email text NOT NULL,
    company text,
    address text,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Client" OWNER TO postgres;

--
-- Name: Client_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Client_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Client_id_seq" OWNER TO postgres;

--
-- Name: Client_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Client_id_seq" OWNED BY public."Client".id;


--
-- Name: Device; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Device" (
    id integer NOT NULL,
    code text NOT NULL,
    type text NOT NULL,
    brand text,
    size text,
    model text,
    color text,
    "gpsId" text,
    "mfgDate" timestamp(3) without time zone,
    "lifecycleStatus" text DEFAULT 'available'::text NOT NULL,
    location text,
    state text,
    district text,
    pinpoint text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "clientId" integer,
    "healthStatus" text DEFAULT 'ok'::text NOT NULL,
    "setId" integer,
    "approvedAt" timestamp(3) without time zone,
    "approvedById" integer,
    "assignedAt" timestamp(3) without time zone,
    barcode text NOT NULL,
    "deployedAt" timestamp(3) without time zone,
    "rejectionNote" text,
    "requestedAt" timestamp(3) without time zone,
    "requestedById" integer
);


ALTER TABLE public."Device" OWNER TO postgres;

--
-- Name: DeviceHistory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DeviceHistory" (
    id integer NOT NULL,
    "deviceId" integer NOT NULL,
    "fromStatus" text NOT NULL,
    "toStatus" text NOT NULL,
    "changedById" integer,
    "changedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    note text
);


ALTER TABLE public."DeviceHistory" OWNER TO postgres;

--
-- Name: DeviceHistory_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."DeviceHistory_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."DeviceHistory_id_seq" OWNER TO postgres;

--
-- Name: DeviceHistory_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."DeviceHistory_id_seq" OWNED BY public."DeviceHistory".id;


--
-- Name: DeviceSet; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DeviceSet" (
    id integer NOT NULL,
    code text NOT NULL,
    barcode text NOT NULL,
    "setType" text NOT NULL,
    "setTypeName" text NOT NULL,
    name text,
    "lifecycleStatus" text DEFAULT 'available'::text NOT NULL,
    "healthStatus" text DEFAULT 'ok'::text NOT NULL,
    location text,
    state text,
    district text,
    notes text,
    "clientId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "approvedAt" timestamp(3) without time zone,
    "approvedById" integer,
    "rejectionNote" text,
    "requestedAt" timestamp(3) without time zone,
    "requestedById" integer
);


ALTER TABLE public."DeviceSet" OWNER TO postgres;

--
-- Name: DeviceSet_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."DeviceSet_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."DeviceSet_id_seq" OWNER TO postgres;

--
-- Name: DeviceSet_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."DeviceSet_id_seq" OWNED BY public."DeviceSet".id;


--
-- Name: Device_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Device_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Device_id_seq" OWNER TO postgres;

--
-- Name: Device_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Device_id_seq" OWNED BY public."Device".id;


--
-- Name: LifecycleRequest; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LifecycleRequest" (
    id integer NOT NULL,
    "deviceId" integer,
    "setId" integer,
    "clientId" integer,
    "fromStep" text NOT NULL,
    "toStep" text NOT NULL,
    "healthStatus" text DEFAULT 'ok'::text NOT NULL,
    "healthNote" text,
    note text,
    "requestedById" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "approvedById" integer,
    "approvedAt" timestamp(3) without time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    "rejectionNote" text,
    "autoApproved" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."LifecycleRequest" OWNER TO postgres;

--
-- Name: LifecycleRequest_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."LifecycleRequest_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."LifecycleRequest_id_seq" OWNER TO postgres;

--
-- Name: LifecycleRequest_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."LifecycleRequest_id_seq" OWNED BY public."LifecycleRequest".id;


--
-- Name: Notification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Notification" (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    "requestId" integer,
    read boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Notification" OWNER TO postgres;

--
-- Name: Notification_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Notification_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Notification_id_seq" OWNER TO postgres;

--
-- Name: Notification_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Notification_id_seq" OWNED BY public."Notification".id;


--
-- Name: Permission; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Permission" (
    id integer NOT NULL,
    module text NOT NULL,
    operation text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Permission" OWNER TO postgres;

--
-- Name: Permission_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Permission_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Permission_id_seq" OWNER TO postgres;

--
-- Name: Permission_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Permission_id_seq" OWNED BY public."Permission".id;


--
-- Name: Role; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Role" (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Role" OWNER TO postgres;

--
-- Name: RolePermission; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."RolePermission" (
    "roleId" integer NOT NULL,
    "permissionId" integer NOT NULL
);


ALTER TABLE public."RolePermission" OWNER TO postgres;

--
-- Name: Role_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."Role_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."Role_id_seq" OWNER TO postgres;

--
-- Name: Role_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."Role_id_seq" OWNED BY public."Role".id;


--
-- Name: TeamRequest; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TeamRequest" (
    id integer NOT NULL,
    "requestedById" integer NOT NULL,
    "deviceId" integer,
    "setId" integer,
    "requestType" text NOT NULL,
    changes jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    note text,
    "adminNote" text,
    "approvedById" integer,
    "approvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."TeamRequest" OWNER TO postgres;

--
-- Name: TeamRequestComment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TeamRequestComment" (
    id integer NOT NULL,
    "teamRequestId" integer NOT NULL,
    "authorId" integer NOT NULL,
    "authorRole" text NOT NULL,
    message text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "authorName" text NOT NULL
);


ALTER TABLE public."TeamRequestComment" OWNER TO postgres;

--
-- Name: TeamRequestComment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."TeamRequestComment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."TeamRequestComment_id_seq" OWNER TO postgres;

--
-- Name: TeamRequestComment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."TeamRequestComment_id_seq" OWNED BY public."TeamRequestComment".id;


--
-- Name: TeamRequest_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."TeamRequest_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."TeamRequest_id_seq" OWNER TO postgres;

--
-- Name: TeamRequest_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."TeamRequest_id_seq" OWNED BY public."TeamRequest".id;


--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id integer NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    password text NOT NULL,
    status text DEFAULT 'ACTIVE'::text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "roleId" integer NOT NULL
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public."User_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public."User_id_seq" OWNER TO postgres;

--
-- Name: User_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public."User_id_seq" OWNED BY public."User".id;


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Name: AssignmentRequest id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AssignmentRequest" ALTER COLUMN id SET DEFAULT nextval('public."AssignmentRequest_id_seq"'::regclass);


--
-- Name: Client id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Client" ALTER COLUMN id SET DEFAULT nextval('public."Client_id_seq"'::regclass);


--
-- Name: Device id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Device" ALTER COLUMN id SET DEFAULT nextval('public."Device_id_seq"'::regclass);


--
-- Name: DeviceHistory id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeviceHistory" ALTER COLUMN id SET DEFAULT nextval('public."DeviceHistory_id_seq"'::regclass);


--
-- Name: DeviceSet id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeviceSet" ALTER COLUMN id SET DEFAULT nextval('public."DeviceSet_id_seq"'::regclass);


--
-- Name: LifecycleRequest id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LifecycleRequest" ALTER COLUMN id SET DEFAULT nextval('public."LifecycleRequest_id_seq"'::regclass);


--
-- Name: Notification id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification" ALTER COLUMN id SET DEFAULT nextval('public."Notification_id_seq"'::regclass);


--
-- Name: Permission id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Permission" ALTER COLUMN id SET DEFAULT nextval('public."Permission_id_seq"'::regclass);


--
-- Name: Role id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Role" ALTER COLUMN id SET DEFAULT nextval('public."Role_id_seq"'::regclass);


--
-- Name: TeamRequest id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TeamRequest" ALTER COLUMN id SET DEFAULT nextval('public."TeamRequest_id_seq"'::regclass);


--
-- Name: TeamRequestComment id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TeamRequestComment" ALTER COLUMN id SET DEFAULT nextval('public."TeamRequestComment_id_seq"'::regclass);


--
-- Name: User id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User" ALTER COLUMN id SET DEFAULT nextval('public."User_id_seq"'::regclass);


--
-- Data for Name: AssignmentRequest; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AssignmentRequest" (id, "requestType", "deviceId", "setId", "clientId", "healthStatus", "healthComment", "returnType", "returnDays", "returnMonths", "returnDate", "computedReturnDate", status, "requestedBy", "approvedBy", "approvedAt", "createdAt", "updatedAt") FROM stdin;
1	device	90	\N	1	ok	\N	months	\N	3	\N	2026-05-20 12:36:58.678	pending	1	\N	\N	2026-02-20 12:36:58.693	2026-02-20 12:36:58.693
2	set	\N	3	1	ok	\N	days	60	\N	\N	2026-04-23 18:28:23.422	pending	1	\N	\N	2026-02-22 18:28:23.425	2026-02-22 18:28:23.425
3	set	\N	2	2	ok	\N	days	30	\N	\N	2026-03-24 18:34:32.788	pending	1	\N	\N	2026-02-22 18:34:32.79	2026-02-22 18:34:32.79
4	set	\N	3	2	ok	\N	days	30	\N	\N	2026-03-24 18:42:59.125	pending	1	\N	\N	2026-02-22 18:42:59.127	2026-02-22 18:42:59.127
5	set	\N	3	1	ok	\N	months	\N	3	\N	2026-05-23 04:54:26.344	pending	1	\N	\N	2026-02-23 04:54:26.346	2026-02-23 04:54:26.346
6	set	\N	4	1	ok	\N	months	\N	3	\N	2026-05-23 05:11:44.416	pending	1	\N	\N	2026-02-23 05:11:44.418	2026-02-23 05:11:44.418
7	set	\N	2	2	ok	\N	days	60	\N	\N	2026-04-24 07:44:37.844	pending	3	\N	\N	2026-02-23 07:44:37.846	2026-02-23 07:44:37.846
8	set	\N	2	2	ok	\N	days	30	\N	\N	2026-03-25 07:45:27.99	pending	3	\N	\N	2026-02-23 07:45:27.991	2026-02-23 07:45:27.991
9	set	\N	2	1	ok	\N	days	30	\N	\N	2026-03-25 08:50:04.989	pending	3	\N	\N	2026-02-23 08:50:04.991	2026-02-23 08:50:04.991
10	set	\N	1	2	ok	\N	days	60	\N	\N	2026-04-24 08:50:33.382	pending	3	\N	\N	2026-02-23 08:50:33.383	2026-02-23 08:50:33.383
11	set	\N	2	2	ok	\N	days	60	\N	\N	2026-04-24 08:51:49.859	pending	1	\N	\N	2026-02-23 08:51:49.861	2026-02-23 08:51:49.861
12	set	\N	2	2	ok	\N	days	60	\N	\N	2026-04-24 09:05:30.373	pending	3	\N	\N	2026-02-23 09:05:30.375	2026-02-23 09:05:30.375
13	set	\N	2	2	ok	\N	days	30	\N	\N	2026-03-25 09:16:34.797	pending	3	\N	\N	2026-02-23 09:16:34.799	2026-02-23 09:16:34.799
14	set	\N	1	1	ok	\N	days	30	\N	\N	2026-03-25 09:17:05.205	pending	3	\N	\N	2026-02-23 09:17:05.208	2026-02-23 09:17:05.208
15	set	\N	2	1	ok	\N	days	30	\N	\N	2026-03-25 09:24:04.024	pending	3	\N	\N	2026-02-23 09:24:04.026	2026-02-23 09:24:04.026
16	set	\N	2	1	ok	\N	days	30	\N	\N	2026-03-25 09:34:26.683	pending	3	\N	\N	2026-02-23 09:34:26.685	2026-02-23 09:34:26.685
17	set	\N	2	2	ok	\N	days	30	\N	\N	2026-03-25 09:36:01.754	pending	3	\N	\N	2026-02-23 09:36:01.755	2026-02-23 09:36:01.755
18	set	\N	2	1	ok	\N	days	30	\N	\N	2026-03-25 09:41:00.846	pending	3	\N	\N	2026-02-23 09:41:00.85	2026-02-23 09:41:00.85
\.


--
-- Data for Name: Client; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Client" (id, name, phone, email, company, address, notes, "createdAt") FROM stdin;
1	dominos	123456789	client@example	jubiliant	sdfefefef	\N	2026-02-20 12:36:32.186
2	GAming gc	123456789	Gaming@gmail.com	bdhsgdgsgd	Banshi Apartment	\N	2026-02-22 18:24:58.779
3	Mac D	123456789	mac@gmail.com	Burger wale	Gurgaon,Haryana	\N	2026-02-24 07:59:57.393
\.


--
-- Data for Name: Device; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Device" (id, code, type, brand, size, model, color, "gpsId", "mfgDate", "lifecycleStatus", location, state, district, pinpoint, "createdAt", "updatedAt", "clientId", "healthStatus", "setId", "approvedAt", "approvedById", "assignedAt", barcode, "deployedAt", "rejectionNote", "requestedAt", "requestedById") FROM stdin;
2	TV-002	tv	Samsung	43"	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:30:59.401	2026-02-20 12:30:59.401	\N	ok	\N	\N	\N	\N	EDSG-TV-90659394-YH17	\N	\N	\N	\N
4	TV-004	tv	Samsung	43"	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:30:59.401	2026-02-20 12:30:59.401	\N	ok	\N	\N	\N	\N	EDSG-TV-90659394-JEZ1	\N	\N	\N	\N
5	TV-005	tv	Samsung	43"	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:30:59.401	2026-02-20 12:30:59.401	\N	ok	\N	\N	\N	\N	EDSG-TV-90659394-1X5O	\N	\N	\N	\N
7	TV-007	tv	Samsung	43"	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:30:59.401	2026-02-20 12:30:59.401	\N	ok	\N	\N	\N	\N	EDSG-TV-90659394-GS21	\N	\N	\N	\N
9	TV-009	tv	Samsung	43"	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:30:59.401	2026-02-20 12:30:59.401	\N	ok	\N	\N	\N	\N	EDSG-TV-90659394-H1QF	\N	\N	\N	\N
11	ATV-001	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-97X8	\N	\N	\N	\N
12	ATV-002	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-CX7Z	\N	\N	\N	\N
13	ATV-003	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-LPSY	\N	\N	\N	\N
14	ATV-004	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-7CEN	\N	\N	\N	\N
15	ATV-005	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-GKOA	\N	\N	\N	\N
16	ATV-006	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-OQIN	\N	\N	\N	\N
18	ATV-008	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-VIC0	\N	\N	\N	\N
19	ATV-009	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-WZN5	\N	\N	\N	\N
20	ATV-010	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-2RBS	\N	\N	\N	\N
21	ATV-011	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-GUDQ	\N	\N	\N	\N
22	ATV-012	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-QFUI	\N	\N	\N	\N
23	ATV-013	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-84U7	\N	\N	\N	\N
24	ATV-014	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-9QVC	\N	\N	\N	\N
25	ATV-015	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-R6RT	\N	\N	\N	\N
26	ATV-016	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-UJ1U	\N	\N	\N	\N
28	ATV-018	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-IPN4	\N	\N	\N	\N
29	ATV-019	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-5F5E	\N	\N	\N	\N
30	ATV-020	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-K81R	\N	\N	\N	\N
31	ATV-021	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-KLI0	\N	\N	\N	\N
32	ATV-022	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-G04J	\N	\N	\N	\N
33	ATV-023	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-TTTY	\N	\N	\N	\N
34	ATV-024	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-I6CD	\N	\N	\N	\N
35	ATV-025	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:31:19.899	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-ALR4	\N	\N	\N	\N
37	TST-001	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-4WQT	\N	\N	\N	\N
39	TST-003	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-X8S8	\N	\N	\N	\N
40	TST-004	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-K5LN	\N	\N	\N	\N
41	TST-005	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-TZ57	\N	\N	\N	\N
42	TST-006	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-EHY8	\N	\N	\N	\N
43	TST-007	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-LIOX	\N	\N	\N	\N
44	TST-008	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-EPW4	\N	\N	\N	\N
45	TST-009	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-D8DQ	\N	\N	\N	\N
46	TST-010	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-ODKC	\N	\N	\N	\N
47	TST-011	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-WZ8K	\N	\N	\N	\N
48	TST-012	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-UAGN	\N	\N	\N	\N
49	TST-013	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-BYTR	\N	\N	\N	\N
50	TST-014	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-RHR2	\N	\N	\N	\N
51	TST-015	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-9L3T	\N	\N	\N	\N
52	TST-016	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-HGKE	\N	\N	\N	\N
6	TV-006	tv	Samsung	43"	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:30:59.401	2026-02-20 12:37:46.03	\N	ok	2	\N	\N	\N	EDSG-TV-90659394-YB7L	\N	\N	\N	\N
36	ITV-001	IST	N/A	N/A	N/A	Blue	\N	2026-02-27 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:37.314	2026-02-20 12:37:46.03	\N	ok	2	\N	\N	\N	EDSG-IST-90697290-2UTE	\N	\N	\N	\N
17	ATV-007	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-23 05:18:58.309	\N	ok	\N	\N	\N	\N	EDSG-AST-90679894-J5NI	\N	\N	\N	\N
3	TV-003	tv	Samsung	43"	N/A	Black	\N	2026-02-20 00:00:00	assigning	Warehouse A	\N	\N	\N	2026-02-20 12:30:59.401	2026-02-24 07:43:24.421	1	ok	5	\N	\N	\N	EDSG-TV-90659394-UHWJ	\N	\N	\N	\N
10	TV-010	tv	Samsung	43"	N/A	Black	\N	2026-02-20 00:00:00	assigning	Warehouse A	\N	\N	\N	2026-02-20 12:30:59.401	2026-02-24 08:02:21.779	3	ok	6	\N	\N	\N	EDSG-TV-90659394-DZ4J	\N	\N	\N	\N
38	TST-002	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	assigning	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-24 09:29:41.05	1	ok	\N	\N	\N	\N	EDSG-TST-90723926-2C1O	\N	\N	\N	\N
1	TV-001	tv	Samsung	43"	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:30:59.401	2026-02-24 11:15:37.897	\N	ok	7	\N	\N	\N	EDSG-TV-90659393-FY00	\N	\N	\N	\N
53	TST-017	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-IDCT	\N	\N	\N	\N
54	TST-018	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-KWP9	\N	\N	\N	\N
55	TST-019	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-IPZY	\N	\N	\N	\N
56	TST-020	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-5YSR	\N	\N	\N	\N
57	TST-021	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-IQCG	\N	\N	\N	\N
58	TST-022	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-180K	\N	\N	\N	\N
59	TST-023	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-OGMR	\N	\N	\N	\N
60	TST-024	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-YG7N	\N	\N	\N	\N
61	TST-025	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-0F4T	\N	\N	\N	\N
62	TST-026	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-O582	\N	\N	\N	\N
63	TST-027	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-2RGY	\N	\N	\N	\N
64	TST-028	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-J9C9	\N	\N	\N	\N
65	TST-029	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-CACY	\N	\N	\N	\N
66	TST-030	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-RGHB	\N	\N	\N	\N
67	TST-031	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-IPAO	\N	\N	\N	\N
68	TST-032	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-9UR6	\N	\N	\N	\N
69	TST-033	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-WG65	\N	\N	\N	\N
70	TST-034	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-RA25	\N	\N	\N	\N
71	TST-035	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-NS6N	\N	\N	\N	\N
72	TST-036	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-VFSE	\N	\N	\N	\N
73	TST-037	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-LABT	\N	\N	\N	\N
74	TST-038	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-D0QS	\N	\N	\N	\N
75	TST-039	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-5VIL	\N	\N	\N	\N
76	TST-040	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-P2CU	\N	\N	\N	\N
77	TST-041	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-C8EX	\N	\N	\N	\N
78	TST-042	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-XJXR	\N	\N	\N	\N
79	TST-043	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-W8ZE	\N	\N	\N	\N
80	TST-044	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723926-NC1Z	\N	\N	\N	\N
81	TST-045	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723927-A0RH	\N	\N	\N	\N
82	TST-046	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723927-35N1	\N	\N	\N	\N
83	TST-047	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723927-VSG9	\N	\N	\N	\N
84	TST-048	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723927-Z3EL	\N	\N	\N	\N
85	TST-049	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723927-YV8Y	\N	\N	\N	\N
86	TST-050	TST	N/A	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:32:03.933	2026-02-20 12:32:03.933	\N	ok	\N	\N	\N	\N	EDSG-TST-90723927-01R4	\N	\N	\N	\N
94	MB-008	MB	EDSignage	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:33:38.138	2026-02-20 12:33:38.138	\N	ok	\N	\N	\N	\N	EDSG-MB-90818135-J7VT	\N	\N	\N	\N
95	MB-009	MB	EDSignage	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:33:38.138	2026-02-20 12:33:38.138	\N	ok	\N	\N	\N	\N	EDSG-MB-90818135-C1EB	\N	\N	\N	\N
8	TV-008	tv	Samsung	43"	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:30:59.401	2026-02-20 12:34:23.441	\N	ok	1	\N	\N	\N	EDSG-TV-90659394-YC0Z	\N	\N	\N	\N
27	ATV-017	AST	EDSignage	N/A	N/A	Black	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:31:19.899	2026-02-20 12:34:23.441	\N	ok	1	\N	\N	\N	EDSG-AST-90679894-TSWH	\N	\N	\N	\N
90	MB-004	MB	EDSignage	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:33:38.138	2026-02-20 12:34:23.441	\N	ok	1	\N	\N	\N	EDSG-MB-90818135-0EBM	\N	\N	\N	\N
89	MB-003	MB	EDSignage	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:33:38.138	2026-02-20 12:37:46.03	\N	ok	2	\N	\N	\N	EDSG-MB-90818135-BZ43	\N	\N	\N	\N
97			\N	\N	\N	\N	\N	\N	warehouse	\N	\N	\N	\N	2026-02-20 12:41:02.858	2026-02-20 12:41:00.195	\N	ok	\N	\N	\N	\N		\N	\N	\N	\N
100	TV-012	tv	LG	50"	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-22 18:27:16.68	2026-02-22 18:27:16.68	\N	ok	\N	\N	\N	\N	EDSG-TV-84836675-0KVV	\N	\N	\N	\N
101	TV-013	tv	LG	50"	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-22 18:27:16.68	2026-02-22 18:27:16.68	\N	ok	\N	\N	\N	\N	EDSG-TV-84836675-IUFX	\N	\N	\N	\N
102	TV-014	tv	LG	50"	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-22 18:27:16.68	2026-02-22 18:27:16.68	\N	ok	\N	\N	\N	\N	EDSG-TV-84836675-S8YL	\N	\N	\N	\N
103	TV-015	tv	LG	50"	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-22 18:27:16.68	2026-02-22 18:27:16.68	\N	ok	\N	\N	\N	\N	EDSG-TV-84836675-KJH0	\N	\N	\N	\N
96	MB-010	MB	EDSignage	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:33:38.138	2026-02-23 05:19:06.976	\N	ok	\N	\N	\N	\N	EDSG-MB-90818135-A5QF	\N	\N	\N	\N
88	MB-002	MB	EDSignage	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	bhama shah dwar	\N	\N	\N	2026-02-20 12:33:38.138	2026-02-24 06:07:36.978	\N	repair	\N	\N	\N	\N	EDSG-MB-90818135-I0AL	\N	\N	\N	\N
91	MB-005	MB	EDSignage	N/A	N/A	White	\N	2026-02-20 00:00:00	assigning	Warehouse A	\N	\N	\N	2026-02-20 12:33:38.138	2026-02-24 07:43:24.421	1	ok	5	\N	\N	\N	EDSG-MB-90818135-XC4P	\N	\N	\N	\N
93	MB-007	MB	EDSignage	N/A	N/A	White	\N	2026-02-20 00:00:00	assigning	Warehouse A	\N	\N	\N	2026-02-20 12:33:38.138	2026-02-24 08:01:10.158	3	repair	6	\N	\N	\N	EDSG-MB-90818135-AEXM	\N	\N	\N	\N
87	MB-001	MB	EDSignage	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:33:38.138	2026-02-24 11:15:37.897	\N	ok	7	\N	\N	\N	EDSG-MB-90818135-P9WP	\N	\N	\N	\N
104	TV-016	tv	LG	50"	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-22 18:27:16.68	2026-02-22 18:27:16.68	\N	ok	\N	\N	\N	\N	EDSG-TV-84836675-7V3G	\N	\N	\N	\N
105	TV-017	tv	LG	50"	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-22 18:27:16.68	2026-02-22 18:27:16.68	\N	ok	\N	\N	\N	\N	EDSG-TV-84836675-WXXZ	\N	\N	\N	\N
106	TV-018	tv	LG	50"	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-22 18:27:16.68	2026-02-22 18:27:16.68	\N	ok	\N	\N	\N	\N	EDSG-TV-84836675-8JYK	\N	\N	\N	\N
107	TV-019	tv	LG	50"	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-22 18:27:16.68	2026-02-22 18:27:16.68	\N	ok	\N	\N	\N	\N	EDSG-TV-84836675-DJXJ	\N	\N	\N	\N
109	TV-021	tv	LG	50"	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-22 18:27:16.68	2026-02-22 18:27:16.68	\N	ok	\N	\N	\N	\N	EDSG-TV-84836676-LIBY	\N	\N	\N	\N
110	TV-022	tv	TCL	43"	N/A	Black	\N	2026-02-24 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-23 05:05:54.389	2026-02-23 05:05:54.389	\N	ok	\N	\N	\N	\N	EDSG-TV-23154379-ZNYV	\N	\N	\N	\N
114	ATV-029	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 05:06:53.637	\N	ok	\N	\N	\N	\N	EDSG-AST-23213619-BFKB	\N	\N	\N	\N
115	ATV-030	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 05:06:53.637	\N	ok	\N	\N	\N	\N	EDSG-AST-23213619-AABZ	\N	\N	\N	\N
116	ATV-031	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 05:06:53.637	\N	ok	\N	\N	\N	\N	EDSG-AST-23213619-J04Y	\N	\N	\N	\N
118	ATV-033	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 05:06:53.637	\N	ok	\N	\N	\N	\N	EDSG-AST-23213619-LWBH	\N	\N	\N	\N
124	ATV-039	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 05:06:53.637	\N	ok	\N	\N	\N	\N	EDSG-AST-23213619-63QD	\N	\N	\N	\N
126	ATV-041	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 05:06:53.637	\N	ok	\N	\N	\N	\N	EDSG-AST-23213619-VAGZ	\N	\N	\N	\N
128	ATV-043	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 05:06:53.637	\N	ok	\N	\N	\N	\N	EDSG-AST-23213620-0LIC	\N	\N	\N	\N
129	ATV-044	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 05:06:53.637	\N	ok	\N	\N	\N	\N	EDSG-AST-23213620-DHSS	\N	\N	\N	\N
130	ATV-045	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 05:06:53.637	\N	ok	\N	\N	\N	\N	EDSG-AST-23213620-4GRH	\N	\N	\N	\N
131	ATV-046	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 05:06:53.637	\N	ok	\N	\N	\N	\N	EDSG-AST-23213620-ILVI	\N	\N	\N	\N
132	ATV-047	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 05:06:53.637	\N	ok	\N	\N	\N	\N	EDSG-AST-23213620-KB4H	\N	\N	\N	\N
133	ATV-048	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 05:06:53.637	\N	ok	\N	\N	\N	\N	EDSG-AST-23213620-HDN1	\N	\N	\N	\N
134	ATV-049	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 05:06:53.637	\N	ok	\N	\N	\N	\N	EDSG-AST-23213620-HH6P	\N	\N	\N	\N
135	ATV-050	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	assign_requested	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 05:09:24.572	1	ok	\N	\N	\N	\N	EDSG-AST-23213620-G8GU	\N	\N	2026-02-23 05:09:24.57	1
92	MB-006	MB	EDSignage	N/A	N/A	White	\N	2026-02-20 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-20 12:33:38.138	2026-02-23 05:18:58.315	\N	ok	\N	\N	\N	\N	EDSG-MB-90818135-I97C	\N	\N	\N	\N
99	TV-011	tv	Samsung	50"	N/A	Gray	\N	2026-02-22 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-22 18:23:11.031	2026-02-23 05:19:06.982	\N	ok	\N	2026-02-22 18:33:34.533	1	\N	EDSG-TV-84591024-AKTX	\N	\N	\N	\N
117	ATV-032	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	assigning	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 10:38:15.962	2	ok	\N	\N	\N	\N	EDSG-AST-23213619-1E4Y	2026-02-23 10:38:15.955	\N	\N	\N
123	ATV-038	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	assigning	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 11:01:03.683	\N	ok	\N	\N	\N	\N	EDSG-AST-23213619-FENR	\N	\N	\N	\N
122	ATV-037	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	assigning	ambience mall	haryana	gurugram	\N	2026-02-23 05:06:53.637	2026-02-23 11:43:51.384	\N	ok	\N	\N	\N	\N	EDSG-AST-23213619-T02P	\N	\N	\N	\N
108	TV-020	tv	LG	50"	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Grand Mall	Bihar	Muzaffarpur	Mithanpura	2026-02-22 18:27:16.68	2026-02-24 06:03:18.164	\N	damage	\N	\N	\N	\N	EDSG-TV-84836676-58HI	\N	\N	\N	\N
112	ATV-027	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	assigning	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-24 07:43:24.421	1	ok	5	\N	\N	\N	EDSG-AST-23213619-RWN0	\N	\N	\N	\N
119	ATV-034	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	assigning	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 10:46:34.165	\N	repair	\N	\N	\N	\N	EDSG-AST-23213619-B27D	\N	\N	\N	\N
121	ATV-036	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	assigning	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-23 11:00:02.251	\N	damage	\N	\N	\N	\N	EDSG-AST-23213619-2FKA	\N	\N	\N	\N
125	ATV-040	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	assigning	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-24 05:32:30.859	\N	damage	\N	\N	\N	\N	EDSG-AST-23213619-CA89	\N	\N	\N	\N
127	ATV-042	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-24 05:41:54.192	\N	damage	\N	\N	\N	\N	EDSG-AST-23213620-NK1K	\N	\N	\N	\N
111	ATV-026	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	assigning	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-24 08:01:10.158	3	repair	6	\N	\N	\N	EDSG-AST-23213619-8Z1J	\N	\N	\N	\N
120	ATV-035	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	assigning	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-24 08:11:45.87	3	ok	\N	\N	\N	\N	EDSG-AST-23213619-78AP	\N	\N	\N	\N
113	ATV-028	AST	N/A	N/A	N/A	Black	\N	2026-02-23 00:00:00	warehouse	Warehouse A	\N	\N	\N	2026-02-23 05:06:53.637	2026-02-24 11:15:37.897	\N	ok	7	\N	\N	\N	EDSG-AST-23213619-L17R	\N	\N	\N	\N
136	ITV-002	IST	EDSignage	Large	N/A	Silver	\N	2026-02-24 00:00:00	assign_requested	Warehouse A	\N	\N	\N	2026-02-23 05:10:24.943	2026-02-24 11:20:33.13	3	ok	\N	\N	\N	\N	EDSG-IST-23424938-KUPY	\N	\N	2026-02-24 11:20:33.123	3
\.


--
-- Data for Name: DeviceHistory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DeviceHistory" (id, "deviceId", "fromStatus", "toStatus", "changedById", "changedAt", note) FROM stdin;
1	36	created	warehouse	\N	2026-02-20 12:31:37.329	Device added to inventory
2	99	created	warehouse	\N	2026-02-22 18:23:11.07	Device added to inventory
3	99	warehouse	assign_requested	1	2026-02-22 18:25:21.596	Assignment requested for client: GAming gc
4	99	assign_requested	assigned	1	2026-02-22 18:31:01.067	Assignment approved
5	99	assigned	deploy_requested	1	2026-02-22 18:32:14.079	Deployment requested
6	99	deploy_requested	deployed	1	2026-02-22 18:32:51.063	Deployment approved
7	99	deployed	return_requested	1	2026-02-22 18:33:18.491	Return requested
8	99	return_requested	warehouse	1	2026-02-22 18:33:34.561	Return approved — device back in warehouse
9	110	created	warehouse	\N	2026-02-23 05:05:54.417	Device added to inventory
10	135	warehouse	assign_requested	1	2026-02-23 05:09:24.603	Assignment requested for client: dominos
11	136	created	warehouse	\N	2026-02-23 05:10:24.965	Device added to inventory
12	127	ok	damaged	2	2026-02-24 05:41:54.202	[GroundRequest #9] health_change — field: healthStatus
13	108	ok	repair	2	2026-02-24 05:59:09.001	[GroundRequest #10] health_change — field: healthStatus
14	108	Warehouse A	Grand Mall	2	2026-02-24 06:02:03.281	[GroundRequest #11] location_change — field: location
15	108		Bihar	2	2026-02-24 06:02:03.288	[GroundRequest #11] location_change — field: state
16	108		Muzaffarpur	2	2026-02-24 06:02:03.292	[GroundRequest #11] location_change — field: district
17	108		Mithanpura	2	2026-02-24 06:02:03.295	[GroundRequest #11] location_change — field: pinpoint
18	108	repair	damage	2	2026-02-24 06:03:18.17	[GroundRequest #12] health_change — field: healthStatus
19	88	ok	repair	2	2026-02-24 06:04:52.186	[GroundRequest #13] health_change — field: healthStatus
20	88	Warehouse A	bhama shah dwar	2	2026-02-24 06:07:36.984	[GroundRequest #14] location_change — field: location
21	10	repair	ok	2	2026-02-24 08:02:21.782	[GroundRequest #17] health_change — field: healthStatus
22	120		1	2	2026-02-24 08:10:31.732	[GroundRequest #18] assignment — field: clientId
23	120	ok	ok	2	2026-02-24 08:10:31.733	[GroundRequest #18] assignment — field: healthStatus
24	120	1	3	2	2026-02-24 08:11:45.872	[GroundRequest #19] assignment — field: clientId
25	120	ok	ok	2	2026-02-24 08:11:45.873	[GroundRequest #19] assignment — field: healthStatus
26	38		1	2	2026-02-24 09:29:41.057	[GroundRequest #20] assignment — field: clientId
27	38	ok	ok	2	2026-02-24 09:29:41.06	[GroundRequest #20] assignment — field: healthStatus
28	136	warehouse	assign_requested	3	2026-02-24 11:20:33.136	Assignment requested for client: Mac D
\.


--
-- Data for Name: DeviceSet; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DeviceSet" (id, code, barcode, "setType", "setTypeName", name, "lifecycleStatus", "healthStatus", location, state, district, notes, "clientId", "createdAt", "updatedAt", "approvedAt", "approvedById", "rejectionNote", "requestedAt", "requestedById") FROM stdin;
2	ISET-001	EDSG-ISTA-91066019-9J6U	iStand	I-Frame Standee	\N	assigning	ok	Warehouse A	\N	\N	\N	1	2026-02-20 12:37:46.025	2026-02-23 15:51:31.034	\N	\N	\N	\N	\N
1	ASET-001	EDSG-ASTA-90863402-1OAJ	aStand	A-Frame Standee	\N	assigning	ok	Warehouse A	\N	\N	\N	1	2026-02-20 12:34:23.43	2026-02-23 15:57:21.426	\N	\N	\N	\N	\N
5	ASET-002	EDSG-ASTA-14152476-A3WH	aStand	A-Frame Standee	\N	assigning	ok	Warehouse A	\N	\N	\N	1	2026-02-24 06:22:32.485	2026-02-24 13:13:24.374	\N	\N	\N	\N	\N
6	ASET-003	EDSG-ASTA-19816695-P2FO	aStand	A-Frame Standee	\N	assigning	repair	Warehouse A	\N	\N	\N	3	2026-02-24 07:56:56.697	2026-02-24 13:31:10.154	\N	\N	\N	\N	\N
7	ASET-004	EDSG-ASTA-31737884-TROQ	aStand	A-Frame Standee	\N	warehouse	ok	Warehouse A	\N	\N	\N	\N	2026-02-24 11:15:37.895	2026-02-24 11:15:37.895	\N	\N	\N	\N	\N
\.


--
-- Data for Name: LifecycleRequest; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."LifecycleRequest" (id, "deviceId", "setId", "clientId", "fromStep", "toStep", "healthStatus", "healthNote", note, "requestedById", "createdAt", "approvedById", "approvedAt", status, "rejectionNote", "autoApproved") FROM stdin;
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Notification" (id, "userId", title, body, "requestId", read, "createdAt") FROM stdin;
\.


--
-- Data for Name: Permission; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Permission" (id, module, operation, description, "createdAt") FROM stdin;
27	Devices	view_history	View device lifecycle history	2026-02-23 11:59:58.106
28	Sets	create	Create device sets (MakeSets)	2026-02-23 11:59:58.107
29	Sets	read	View device sets	2026-02-23 11:59:58.108
30	Sets	update	Update set details and lifecycle	2026-02-23 11:59:58.108
31	Sets	delete	Delete or disassemble device sets	2026-02-23 11:59:58.109
32	Sets	disassemble	Disassemble a set into individual devices	2026-02-23 11:59:58.109
33	Clients	create	Create new client accounts	2026-02-23 11:59:58.11
34	Clients	read	View clients and their assigned devices	2026-02-23 11:59:58.112
35	Clients	update	Edit client information	2026-02-23 11:59:58.113
36	Clients	delete	Delete clients	2026-02-23 11:59:58.114
37	AssignmentRequests	create	Create assignment requests	2026-02-23 11:59:58.115
38	AssignmentRequests	read	View assignment requests	2026-02-23 11:59:58.116
39	AssignmentRequests	approve	Approve assignment requests	2026-02-23 11:59:58.117
40	AssignmentRequests	reject	Reject assignment requests	2026-02-23 11:59:58.118
41	GroundRequests	create	Submit ground team change requests	2026-02-23 11:59:58.119
42	GroundRequests	read	View ground team requests	2026-02-23 11:59:58.12
43	GroundRequests	approve	Approve ground team requests	2026-02-23 11:59:58.121
44	GroundRequests	reject	Reject ground team requests	2026-02-23 11:59:58.122
275	LifecycleRequests	create	Submit lifecycle step requests (all roles)	2026-02-24 11:12:06.999
276	LifecycleRequests	read	View lifecycle requests	2026-02-24 11:12:07.001
277	LifecycleRequests	approve	Approve lifecycle requests (Manager/SuperAdmin)	2026-02-24 11:12:07.002
278	LifecycleRequests	reject	Reject lifecycle requests (Manager/SuperAdmin)	2026-02-24 11:12:07.003
279	Notifications	read	View own notifications	2026-02-24 11:12:07.004
2	Users	create	Create new user accounts	2026-02-23 11:59:58.075
3	Users	read	View user list and details	2026-02-23 11:59:58.085
4	Users	update	Edit user information and status	2026-02-23 11:59:58.086
5	Users	delete	Delete user accounts	2026-02-23 11:59:58.087
6	Roles	create	Create new roles	2026-02-23 11:59:58.088
7	Roles	read	View roles	2026-02-23 11:59:58.089
8	Roles	update	Edit role details	2026-02-23 11:59:58.09
9	Roles	delete	Delete roles	2026-02-23 11:59:58.091
10	Permissions	create	Create new permissions	2026-02-23 11:59:58.092
11	Permissions	read	View permissions	2026-02-23 11:59:58.093
12	Permissions	update	Edit permissions	2026-02-23 11:59:58.093
13	Permissions	delete	Delete permissions	2026-02-23 11:59:58.095
14	Permissions	assign	Assign permissions to roles	2026-02-23 11:59:58.096
15	Devices	create	Add new devices to inventory	2026-02-23 11:59:58.097
16	Devices	read	View devices and their details	2026-02-23 11:59:58.098
280	Notifications	dismiss	Mark notifications as read	2026-02-24 11:12:07.005
45	Reports	read	View dashboard statistics and reports	2026-02-23 11:59:58.123
46	Barcode	scan	Scan barcodes to look up devices	2026-02-23 11:59:58.124
47	Barcode	generate	Generate and print barcodes	2026-02-23 11:59:58.124
17	Devices	update	Edit device information	2026-02-23 11:59:58.099
18	Devices	delete	Delete devices from inventory	2026-02-23 11:59:58.1
19	Devices	bulk_add	Bulk-add multiple devices at once	2026-02-23 11:59:58.101
20	Devices	assign	Assign devices directly to clients (Manager)	2026-02-23 11:59:58.102
21	Devices	request_assign	Submit an assignment request (GroundTeam)	2026-02-23 11:59:58.102
22	Devices	approve_assign	Approve or reject assignment requests	2026-02-23 11:59:58.103
23	Devices	request_deploy	Submit a deployment request (GroundTeam)	2026-02-23 11:59:58.104
24	Devices	approve_deploy	Approve or reject deployment requests	2026-02-23 11:59:58.105
25	Devices	request_return	Submit a return request (GroundTeam)	2026-02-23 11:59:58.105
26	Devices	approve_return	Approve or reject return requests	2026-02-23 11:59:58.106
\.


--
-- Data for Name: Role; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Role" (id, name, description, "createdAt") FROM stdin;
2	SuperAdmin	Full system access including user management	2026-02-23 12:44:10.622
4	GroundTeam	Submit change requests only; cannot approve	2026-02-23 12:44:10.622
3	Manager	All CRUD; can approve ground team requests	2026-02-23 12:44:10.622
6	Sub manager	Sub manager	2026-02-23 11:48:30.145
\.


--
-- Data for Name: RolePermission; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."RolePermission" ("roleId", "permissionId") FROM stdin;
2	2
2	3
2	4
2	5
2	6
2	7
2	8
2	9
2	10
2	11
2	12
2	13
2	14
2	15
2	16
2	17
2	18
2	19
2	20
2	21
2	22
2	23
2	24
2	25
2	26
2	27
2	28
2	29
2	30
2	31
2	32
2	33
2	34
2	35
2	36
2	37
2	38
2	39
2	40
2	41
2	42
2	43
2	44
2	275
2	276
2	277
2	278
2	279
2	280
2	45
2	46
2	47
3	15
3	16
3	17
3	18
3	19
3	20
3	21
3	22
3	23
3	24
3	25
3	26
3	27
3	28
3	29
3	30
3	31
3	32
3	33
3	34
3	35
3	36
3	37
3	38
3	39
3	40
3	41
3	42
3	43
3	44
3	275
3	276
3	277
3	278
3	279
3	280
3	45
3	46
3	47
4	16
4	27
4	21
4	23
4	25
4	29
4	34
4	37
4	38
4	41
4	42
4	275
4	276
4	279
4	280
4	45
4	46
\.


--
-- Data for Name: TeamRequest; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TeamRequest" (id, "requestedById", "deviceId", "setId", "requestType", changes, status, note, "adminNote", "approvedById", "approvedAt", "createdAt", "updatedAt") FROM stdin;
2	3	\N	2	assignment	[{"to": "1", "from": null, "field": "clientId"}, {"to": "ok", "from": null, "field": "healthStatus"}, {"to": "days", "from": null, "field": "returnType"}, {"to": "30", "from": null, "field": "returnDays"}]	approved	Assign ISET-001 → client "dominos" | Health: ok	\N	2	2026-02-23 10:21:31.081	2026-02-23 10:20:07.748	2026-02-23 10:21:31.083
3	3	\N	1	assignment	[{"to": "1", "from": null, "field": "clientId"}, {"to": "ok", "from": null, "field": "healthStatus"}, {"to": "months", "from": null, "field": "returnType"}, {"to": "3", "from": null, "field": "returnMonths"}]	approved	Assign ASET-001 → client "dominos" | Health: ok	\N	2	2026-02-23 10:27:21.5	2026-02-23 10:24:41.019	2026-02-23 10:27:21.502
1	3	117	\N	assignment	[{"to": "2", "from": null, "field": "clientId"}, {"to": "2026-02-23", "from": null, "field": "deliveryDate"}]	approved	Assign ATV-032 → client "GAming gc" (ID 2). Delivery: 2026-02-23	\N	2	2026-02-23 10:38:15.991	2026-02-23 09:42:26.628	2026-02-23 10:38:15.994
4	3	119	\N	health_change	[{"to": "needs_repair", "from": null, "field": "healthStatus"}]	approved	Types: health_change | Device: ATV-034 | Set: — | paint needed	\N	2	2026-02-23 10:46:34.181	2026-02-23 10:45:57.518	2026-02-23 10:46:34.183
5	3	121	\N	health_change	[{"to": "critical", "from": null, "field": "healthStatus"}]	approved	Types: health_change | Device: ATV-036 | Set: — | display broken 	\N	2	2026-02-23 11:00:02.255	2026-02-23 10:57:48.127	2026-02-23 11:00:02.256
7	3	123	\N	assignment	[{"to": "Assigning to dominos", "from": null, "field": "Assignment"}]	approved	Types: assignment | Device: ATV-038 | Set: —	\N	2	2026-02-23 11:01:03.685	2026-02-23 10:59:14.491	2026-02-23 11:01:03.686
6	3	122	\N	location_change	[{"to": "ambience mall", "from": null, "field": "location"}, {"to": "haryana", "from": null, "field": "state"}, {"to": "gurugram", "from": null, "field": "district"}]	approved	Types: location_change | Device: ATV-037 | Set: —	\N	2	2026-02-23 11:43:51.388	2026-02-23 10:58:21.905	2026-02-23 11:43:51.389
8	3	125	\N	health_change	[{"to": "damaged", "from": null, "field": "healthStatus"}]	approved	Types: health_change | Device: atv-040 | Set: —	\N	2	2026-02-24 05:32:30.888	2026-02-24 05:32:13.636	2026-02-24 05:32:30.89
9	3	127	\N	health_change	[{"to": "damaged", "from": null, "field": "healthStatus"}]	approved	Types: health_change | Device: ATV-042 | Set: — | damaged while transit	\N	2	2026-02-24 05:41:54.225	2026-02-24 05:41:39.828	2026-02-24 05:41:54.227
10	3	108	\N	health_change	[{"to": "repair", "from": null, "field": "healthStatus"}]	approved	Types: health_change | Device: tv-020 | Set: — | screen damaged	\N	2	2026-02-24 05:59:09.007	2026-02-24 05:58:42.359	2026-02-24 05:59:09.009
11	3	108	\N	location_change	[{"to": "Grand Mall", "from": null, "field": "location"}, {"to": "Bihar", "from": null, "field": "state"}, {"to": "Muzaffarpur", "from": null, "field": "district"}, {"to": "Mithanpura", "from": null, "field": "pinpoint"}]	approved	Types: location_change | Device: tv-020 | Set: — | Device sent for client kfc	\N	2	2026-02-24 06:02:03.296	2026-02-24 06:01:42.42	2026-02-24 06:02:03.298
12	3	108	\N	health_change	[{"to": "damage", "from": null, "field": "healthStatus"}]	approved	Types: health_change | Device: tv-020 | Set: —	\N	2	2026-02-24 06:03:18.172	2026-02-24 06:03:10.99	2026-02-24 06:03:18.174
13	3	88	\N	health_change	[{"to": "repair", "from": null, "field": "healthStatus"}]	approved	Types: health_change | Device: MB-002 | Set: — | paint needed\n	\N	2	2026-02-24 06:04:52.191	2026-02-24 06:04:36.632	2026-02-24 06:04:52.193
14	3	88	\N	location_change	[{"to": "bhama shah dwar", "from": null, "field": "location"}]	approved	Types: location_change | Device: MB-002 | Set: —	\N	2	2026-02-24 06:07:36.986	2026-02-24 06:07:07.37	2026-02-24 06:07:36.988
15	3	\N	5	assignment	[{"to": "1", "from": null, "field": "clientId"}, {"to": "ok", "from": null, "field": "healthStatus"}, {"to": "months", "from": null, "field": "returnType"}, {"to": "3", "from": null, "field": "returnMonths"}]	approved	Assign ASET-002 → client "dominos" | Health: ok	\N	2	2026-02-24 07:43:24.425	2026-02-24 07:00:26.005	2026-02-24 07:43:24.427
16	3	\N	6	assignment	[{"to": "3", "from": null, "field": "clientId"}, {"to": "repair", "from": null, "field": "healthStatus"}, {"to": "Thoda paint chahiye", "from": null, "field": "healthComment"}, {"to": "months", "from": null, "field": "returnType"}, {"to": "3", "from": null, "field": "returnMonths"}]	approved	Assign ASET-003 → client "Mac D" | Health: repair (Thoda paint chahiye)	\N	2	2026-02-24 08:01:10.161	2026-02-24 08:00:52.891	2026-02-24 08:01:10.162
17	3	10	\N	health_change	[{"to": "ok", "from": null, "field": "healthStatus"}]	approved	Types: health_change | Device: TV-010 | Set: —	\N	2	2026-02-24 08:02:21.783	2026-02-24 08:02:12.337	2026-02-24 08:02:21.784
18	3	120	\N	assignment	[{"to": "1", "from": null, "field": "clientId"}, {"to": "ok", "from": null, "field": "healthStatus"}, {"to": "days", "from": null, "field": "returnType"}, {"to": "30", "from": null, "field": "returnDays"}]	approved	Assign ATV-035 → client "dominos" | Health: ok	\N	2	2026-02-24 08:10:31.733	2026-02-24 08:10:21.993	2026-02-24 08:10:31.734
19	3	120	\N	assignment	[{"to": "3", "from": null, "field": "clientId"}, {"to": "ok", "from": null, "field": "healthStatus"}, {"to": "days", "from": null, "field": "returnType"}, {"to": "30", "from": null, "field": "returnDays"}]	approved	Assign ATV-035 → client "Mac D" | Health: ok	\N	2	2026-02-24 08:11:45.873	2026-02-24 08:11:30.801	2026-02-24 08:11:45.874
20	2	38	\N	assignment	[{"to": "1", "from": null, "field": "clientId"}, {"to": "ok", "from": null, "field": "healthStatus"}, {"to": "days", "from": null, "field": "returnType"}, {"to": "30", "from": null, "field": "returnDays"}]	approved	Assign TST-002 → client "dominos" | Health: ok	\N	2	2026-02-24 09:29:41.059	2026-02-24 09:29:41.043	2026-02-24 09:29:41.061
\.


--
-- Data for Name: TeamRequestComment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TeamRequestComment" (id, "teamRequestId", "authorId", "authorRole", message, "createdAt", "authorName") FROM stdin;
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, name, email, password, status, "createdAt", "roleId") FROM stdin;
1	eduser1	eduser1@gmail.com	$2b$10$HZQ5lfOaGVXHeSWYNB9wmum1Xo3YzExua7wqFXQtcSKg5kuuEQcXu	ACTIVE	2026-02-20 12:07:46.88	2
2	Gagandeep Sir	gagan@gmail.com	$2b$10$jJGj20L4lygMfEFnvy.P.erurVyCkm51H8ADtk6Nl6a1pfeLujW6m	Active	2026-02-23 07:39:15.421	3
3	Sonu	sonu@gmail.com	$2b$10$R0nQbnUHVPHNx0SVVuJBqOuyqDVyhHlmeVblZBfDk0PtYddcoQ0p.	Active	2026-02-23 07:39:49.285	4
4	Abhishek sir	abhi@gmail.com	$2b$10$VaaxQ.QmHq.yGZJOEmUqgu28jnBRKdI/oG5aOZx1vZuiUEgKhLo/S	Active	2026-02-23 10:25:55.552	3
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
b2bccdfc-140e-459e-96d2-79bcc0cd1c20	dad7944e5ec46f9ee266743f6e65df6a93b831e2784c740bf7bcf48b04756fc1	2026-02-20 17:16:33.719881+05:30	20260212104425_init	\N	\N	2026-02-20 17:16:33.66988+05:30	1
8bb2a14f-d4b8-4e75-9c7e-e14f1b6dfd32	d33c3547c04bdedf2e8269e403d5997abf0fced0a126192f0eb952f5aed686e3	2026-02-20 17:16:33.737481+05:30	20260213114058_add_device_table	\N	\N	2026-02-20 17:16:33.720731+05:30	1
85844f70-b868-4817-9188-3a6b9b2b53ea	dac19a40a0ac6c2fb031e26993e10ac0a4e5d533c4939b7c8e606ecc24430ac2	2026-02-20 17:16:33.741375+05:30	20260217000001_add_health_status	\N	\N	2026-02-20 17:16:33.73826+05:30	1
07d883c8-a0ad-48eb-809b-a2eaa00319f9	51b941c25a24c38ff05298a97f76612efb895d67d30d3976de07e5e62e744222	2026-02-20 17:16:33.779769+05:30	20260217000002_add_device_sets	\N	\N	2026-02-20 17:16:33.742167+05:30	1
8d900bbb-53a0-4b98-89b7-3b972fedaaae	4603709ec29ec3f54ece1e8ef93f25c841d722add3b82a2a563afb8da8d13d48	2026-02-20 18:00:16.573724+05:30	20260220123016_add_barcode_and_requested_by_id	\N	\N	2026-02-20 18:00:16.214506+05:30	1
972001ca-22ce-4420-8957-d675b6398cb9	9618a1247d78a7f5ef823238a4779c9a1459af448e8731f8b97f74ae97a19dea	2026-02-23 11:49:40.62962+05:30	20260223000001_add_team_requests	\N	\N	2026-02-23 11:49:40.532711+05:30	1
a3a9d66f-e705-4456-bf19-3ccd1aab4fcd	0df7cd101c5d8b307ba5468dd53a321c6086a8cb63a5d20fda2cd1c0357f6862	2026-02-23 11:49:41.136602+05:30	20260223061941_add_team_requests	\N	\N	2026-02-23 11:49:41.103841+05:30	1
\.


--
-- Name: AssignmentRequest_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."AssignmentRequest_id_seq"', 18, true);


--
-- Name: Client_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Client_id_seq"', 3, true);


--
-- Name: DeviceHistory_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."DeviceHistory_id_seq"', 28, true);


--
-- Name: DeviceSet_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."DeviceSet_id_seq"', 7, true);


--
-- Name: Device_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Device_id_seq"', 136, true);


--
-- Name: LifecycleRequest_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."LifecycleRequest_id_seq"', 1, false);


--
-- Name: Notification_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Notification_id_seq"', 1, false);


--
-- Name: Permission_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Permission_id_seq"', 283, true);


--
-- Name: Role_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."Role_id_seq"', 6, true);


--
-- Name: TeamRequestComment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."TeamRequestComment_id_seq"', 1, false);


--
-- Name: TeamRequest_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."TeamRequest_id_seq"', 20, true);


--
-- Name: User_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public."User_id_seq"', 4, true);


--
-- Name: AssignmentRequest AssignmentRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AssignmentRequest"
    ADD CONSTRAINT "AssignmentRequest_pkey" PRIMARY KEY (id);


--
-- Name: Client Client_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Client"
    ADD CONSTRAINT "Client_pkey" PRIMARY KEY (id);


--
-- Name: DeviceHistory DeviceHistory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeviceHistory"
    ADD CONSTRAINT "DeviceHistory_pkey" PRIMARY KEY (id);


--
-- Name: DeviceSet DeviceSet_barcode_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeviceSet"
    ADD CONSTRAINT "DeviceSet_barcode_key" UNIQUE (barcode);


--
-- Name: DeviceSet DeviceSet_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeviceSet"
    ADD CONSTRAINT "DeviceSet_code_key" UNIQUE (code);


--
-- Name: DeviceSet DeviceSet_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeviceSet"
    ADD CONSTRAINT "DeviceSet_pkey" PRIMARY KEY (id);


--
-- Name: Device Device_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Device"
    ADD CONSTRAINT "Device_pkey" PRIMARY KEY (id);


--
-- Name: LifecycleRequest LifecycleRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LifecycleRequest"
    ADD CONSTRAINT "LifecycleRequest_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: Permission Permission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Permission"
    ADD CONSTRAINT "Permission_pkey" PRIMARY KEY (id);


--
-- Name: RolePermission RolePermission_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RolePermission"
    ADD CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId");


--
-- Name: Role Role_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Role"
    ADD CONSTRAINT "Role_pkey" PRIMARY KEY (id);


--
-- Name: TeamRequestComment TeamRequestComment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TeamRequestComment"
    ADD CONSTRAINT "TeamRequestComment_pkey" PRIMARY KEY (id);


--
-- Name: TeamRequest TeamRequest_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TeamRequest"
    ADD CONSTRAINT "TeamRequest_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AssignmentRequest_clientId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AssignmentRequest_clientId_idx" ON public."AssignmentRequest" USING btree ("clientId");


--
-- Name: AssignmentRequest_deviceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AssignmentRequest_deviceId_idx" ON public."AssignmentRequest" USING btree ("deviceId");


--
-- Name: AssignmentRequest_setId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AssignmentRequest_setId_idx" ON public."AssignmentRequest" USING btree ("setId");


--
-- Name: AssignmentRequest_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AssignmentRequest_status_idx" ON public."AssignmentRequest" USING btree (status);


--
-- Name: DeviceHistory_deviceId_changedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DeviceHistory_deviceId_changedAt_idx" ON public."DeviceHistory" USING btree ("deviceId", "changedAt");


--
-- Name: DeviceHistory_deviceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DeviceHistory_deviceId_idx" ON public."DeviceHistory" USING btree ("deviceId");


--
-- Name: DeviceSet_barcode_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DeviceSet_barcode_idx" ON public."DeviceSet" USING btree (barcode);


--
-- Name: DeviceSet_clientId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DeviceSet_clientId_idx" ON public."DeviceSet" USING btree ("clientId");


--
-- Name: DeviceSet_lifecycleStatus_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DeviceSet_lifecycleStatus_idx" ON public."DeviceSet" USING btree ("lifecycleStatus");


--
-- Name: DeviceSet_setType_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DeviceSet_setType_idx" ON public."DeviceSet" USING btree ("setType");


--
-- Name: Device_barcode_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Device_barcode_idx" ON public."Device" USING btree (barcode);


--
-- Name: Device_barcode_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Device_barcode_key" ON public."Device" USING btree (barcode);


--
-- Name: Device_clientId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Device_clientId_idx" ON public."Device" USING btree ("clientId");


--
-- Name: Device_code_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Device_code_idx" ON public."Device" USING btree (code);


--
-- Name: Device_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Device_code_key" ON public."Device" USING btree (code);


--
-- Name: Device_lifecycleStatus_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Device_lifecycleStatus_idx" ON public."Device" USING btree ("lifecycleStatus");


--
-- Name: Device_setId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Device_setId_idx" ON public."Device" USING btree ("setId");


--
-- Name: Device_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Device_type_idx" ON public."Device" USING btree (type);


--
-- Name: LifecycleRequest_clientId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LifecycleRequest_clientId_idx" ON public."LifecycleRequest" USING btree ("clientId");


--
-- Name: LifecycleRequest_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LifecycleRequest_createdAt_idx" ON public."LifecycleRequest" USING btree ("createdAt");


--
-- Name: LifecycleRequest_deviceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LifecycleRequest_deviceId_idx" ON public."LifecycleRequest" USING btree ("deviceId");


--
-- Name: LifecycleRequest_requestedById_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LifecycleRequest_requestedById_idx" ON public."LifecycleRequest" USING btree ("requestedById");


--
-- Name: LifecycleRequest_setId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LifecycleRequest_setId_idx" ON public."LifecycleRequest" USING btree ("setId");


--
-- Name: LifecycleRequest_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LifecycleRequest_status_idx" ON public."LifecycleRequest" USING btree (status);


--
-- Name: LifecycleRequest_toStep_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LifecycleRequest_toStep_idx" ON public."LifecycleRequest" USING btree ("toStep");


--
-- Name: Notification_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Notification_userId_idx" ON public."Notification" USING btree ("userId");


--
-- Name: Notification_userId_read_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Notification_userId_read_idx" ON public."Notification" USING btree ("userId", read);


--
-- Name: Permission_module_operation_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Permission_module_operation_key" ON public."Permission" USING btree (module, operation);


--
-- Name: Role_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Role_name_key" ON public."Role" USING btree (name);


--
-- Name: TeamRequestComment_teamRequestId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TeamRequestComment_teamRequestId_idx" ON public."TeamRequestComment" USING btree ("teamRequestId");


--
-- Name: TeamRequest_deviceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TeamRequest_deviceId_idx" ON public."TeamRequest" USING btree ("deviceId");


--
-- Name: TeamRequest_requestedById_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TeamRequest_requestedById_idx" ON public."TeamRequest" USING btree ("requestedById");


--
-- Name: TeamRequest_setId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TeamRequest_setId_idx" ON public."TeamRequest" USING btree ("setId");


--
-- Name: TeamRequest_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "TeamRequest_status_idx" ON public."TeamRequest" USING btree (status);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_roleId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_roleId_idx" ON public."User" USING btree ("roleId");


--
-- Name: DeviceSet update_device_set_updated_at; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER update_device_set_updated_at BEFORE UPDATE ON public."DeviceSet" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: DeviceHistory DeviceHistory_deviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeviceHistory"
    ADD CONSTRAINT "DeviceHistory_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES public."Device"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DeviceSet DeviceSet_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DeviceSet"
    ADD CONSTRAINT "DeviceSet_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Device Device_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Device"
    ADD CONSTRAINT "Device_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Device Device_setId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Device"
    ADD CONSTRAINT "Device_setId_fkey" FOREIGN KEY ("setId") REFERENCES public."DeviceSet"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LifecycleRequest LifecycleRequest_approvedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LifecycleRequest"
    ADD CONSTRAINT "LifecycleRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LifecycleRequest LifecycleRequest_clientId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LifecycleRequest"
    ADD CONSTRAINT "LifecycleRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES public."Client"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LifecycleRequest LifecycleRequest_deviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LifecycleRequest"
    ADD CONSTRAINT "LifecycleRequest_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES public."Device"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: LifecycleRequest LifecycleRequest_requestedById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LifecycleRequest"
    ADD CONSTRAINT "LifecycleRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: LifecycleRequest LifecycleRequest_setId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LifecycleRequest"
    ADD CONSTRAINT "LifecycleRequest_setId_fkey" FOREIGN KEY ("setId") REFERENCES public."DeviceSet"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RolePermission RolePermission_permissionId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RolePermission"
    ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES public."Permission"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RolePermission RolePermission_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RolePermission"
    ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TeamRequestComment TeamRequestComment_teamRequestId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TeamRequestComment"
    ADD CONSTRAINT "TeamRequestComment_teamRequestId_fkey" FOREIGN KEY ("teamRequestId") REFERENCES public."TeamRequest"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict BvrsjnLk8CIXTYkjbnwVsdz9UluzFwT1zmcfvzu7sXfG52viFnbnKJ8hmTW87EU

