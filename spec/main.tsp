import "@typespec/http";

using TypeSpec.Http;

/**
 * Контракт сервиса «Календарь звонков» (Issue #11).
 *
 * Является единственным источником истины для API: из него генерируются
 * OpenAPI-спецификация, клиентский SDK фронтенда и серверные артефакты
 * (validation schemas и route scaffolds) для Fastify.
 *
 * Время и даты — в локальном времени владельца календаря (конвертация
 * часовых поясов посетителя не предусмотрена).
 */
@service(#{ title: "Календарь звонков" })
@route("/api")
namespace CallCalendar {
  // -------------------------------------------------------------
  // Скаляры времени
  // -------------------------------------------------------------

  /** Момент времени, RFC 3339, в локальном времени владельца. */
  @format("date-time")
  scalar LocalDateTime extends string;

  /** Дата YYYY-MM-DD в локальном времени владельца. */
  @format("date")
  scalar LocalDate extends string;

  /** Время суток "HH:MM" в локальном времени владельца. */
  @pattern("^(?:[01]\\d|2[0-3]):[0-5]\\d$")
  scalar LocalTime extends string;

  // -------------------------------------------------------------
  // Справочники
  // -------------------------------------------------------------

  /** День недели по ISO-8601: 1 = понедельник, … 7 = воскресенье. */
  enum DayOfWeek {
    Monday: 1,
    Tuesday: 2,
    Wednesday: 3,
    Thursday: 4,
    Friday: 5,
    Saturday: 6,
    Sunday: 7,
  }

  /** Статус записи. */
  enum BookingStatus {
    /** Активна. */
    Active: "active",

    /** Отменена владельцем. */
    Cancelled: "cancelled",
  }

  /** Диапазон выдачи списка звонков владельцу. */
  enum BookingScope {
    /** Будущие звонки, по возрастанию времени. */
    Future: "future",

    /** Прошлые звонки, по убыванию времени. */
    Past: "past",
  }

  // -------------------------------------------------------------
  // Модели домена
  // -------------------------------------------------------------

  /** Тип звонка, предлагаемый владельцем. */
  model BookingType {
    /** Уникальный идентификатор типа звонка. */
    id: string;

    /** Непустое название, уникальное среди активных типов. */
    @minLength(1)
    @maxLength(120)
    name: string;

    /** Необязательное описание; может быть пустым. */
    description?: string;

    /** Длительность звонка в минутах, положительное целое. */
    @minValue(1)
    durationMinutes: int32;
  }

  /** Снимок типа звонка внутри записи (не меняется после записи). */
  model BookingTypeSnapshot {
    id: string;
    name: string;
    durationMinutes: int32;
  }

  /** Запись на звонок. */
  model Booking {
    /** Уникальный идентификатор записи. */
    id: string;

    /** Снимок типа звонка на момент записи. */
    type: BookingTypeSnapshot;

    /** Начало интервала в локальном времени владельца. */
    start: LocalDateTime;

    /** Конец интервала в локальном времени владельца. */
    end: LocalDateTime;

    /** Имя посетителя. */
    @minLength(1)
    name: string;

    /** Email посетителя. */
    @format("email")
    email: string;

    /** Необязательный комментарий посетителя. */
    comment?: string;

    /** Текущий статус записи. */
    status: BookingStatus;
  }

  /**
   * Свободный слот в локальном времени владельца.
   * Слот — вычисляемая проекция, не хранится.
   */
  model Slot {
    /** Начало слота, кратно 15 минутам от начала часа. */
    start: LocalDateTime;

    /** Конец слота = start + длительность выбранного типа. */
    end: LocalDateTime;
  }

  /** Интервал доступности внутри дня. */
  model TimeInterval {
    /** Начало интервала (включительно). */
    start: LocalTime;

    /** Конец интервала (исключительно). */
    end: LocalTime;
  }

  /** Расписание одного дня недели. */
  model DaySchedule {
    dayOfWeek: DayOfWeek;

    /** Открытые интервалы; пустой список — день закрыт. */
    intervals: TimeInterval[];
  }

  /**
   * Недельное расписание доступности владельца.
   * Повторяется каждую неделю; перерывы выражаются отсутствием интервала.
   */
  model Schedule {
    /** По одному элементу на каждый день недели. */
    days: DaySchedule[];
  }

  /** Календарь одной недели: расписание и записи вместе. */
  model CalendarWeek {
    /** Дата понедельника недели. */
    weekStart: LocalDate;

    schedule: Schedule;

    /** Записи, пересекающие эту неделю. */
    bookings: Booking[];
  }

  /** Страница списка звонков владельца. */
  model BookingPage {
    items: Booking[];

    /**
     * Непрозрачный курсор для следующей страницы;
     * отсутствует, когда страница последняя.
     */
    nextCursor?: string;
  }

  // -------------------------------------------------------------
  // Запросы
  // -------------------------------------------------------------

  /** Тело запроса создания записи посетителем. */
  model CreateBookingRequest {
    /** Тип звонка, на который записывается посетитель. */
    typeId: string;

    /** Начало слота в локальном времени владельца. */
    start: LocalDateTime;

    @minLength(1)
    name: string;

    @format("email")
    email: string;

    comment?: string;
  }

  /** Тело запроса создания типа звонка. */
  model CreateBookingTypeRequest {
    @minLength(1)
    @maxLength(120)
    name: string;

    description?: string;

    @minValue(1)
    durationMinutes: int32;
  }

  /** Тело запроса обновления типа звонка. */
  model UpdateBookingTypeRequest {
    @minLength(1)
    @maxLength(120)
    name?: string;

    description?: string;

    @minValue(1)
    durationMinutes?: int32;
  }

  // -------------------------------------------------------------
  // Ответы об ошибках
  // -------------------------------------------------------------

  /** Тело ответа об ошибке. */
  model ErrorBody {
    message: string;
  }

  /** 400 — невалидные данные запроса. */
  model InvalidRequest {
    @statusCode _: 400;
    @body body: ErrorBody;
  }

  /** 404 — ресурс не найден. */
  model NotFound {
    @statusCode _: 404;
    @body body: ErrorBody;
  }

  /** 409 — конфликт: слот занят либо недопустимое состояние перехода. */
  model Conflict {
    @statusCode _: 409;
    @body body: ErrorBody;
  }

  /** 201 — созданная запись. */
  model BookingCreated {
    @statusCode _: 201;
    @body body: Booking;
  }

  /** 201 — созданный тип звонка. */
  model BookingTypeCreated {
    @statusCode _: 201;
    @body body: BookingType;
  }

  /** 204 — операция выполнена без тела ответа. */
  model NoContent {
    @statusCode _: 204;
  }

  // -------------------------------------------------------------
  // Операции: посетитель
  // -------------------------------------------------------------

  /** Активные типы звонков для выбора посетителем. */
  @route("/types")
  @get
  op listBookingTypes(): BookingType[];

  /**
   * Свободные слоты для типа звонка в диапазоне дат.
   * Слоты вычисляются из расписания под длительность типа:
   * начало слота кратно 15 минутам, интервал целиком свободен
   * и не пересекается с активными записями.
   */
  @route("/types/{typeId}/slots")
  @get
  op listSlots(
    @path typeId: string,
    @query from: LocalDate,
    @query to: LocalDate,
  ): Slot[] | InvalidRequest;

  /**
   * Закрепить слот за посетителем.
   * Создание фиксирует слот немедленно (статус «active») и атомарно
   * проверяет главный инвариант: интервал целиком внутри доступного
   * интервала расписания и не пересекается с активной записью.
   */
  @route("/bookings")
  @post
  op createBooking(@body body: CreateBookingRequest): BookingCreated | Conflict | InvalidRequest;

  // -------------------------------------------------------------
  // Операции: владелец — расписание и календарь
  // -------------------------------------------------------------

  /** Текущее недельное расписание доступности. */
  @route("/schedule")
  @get
  op getSchedule(): Schedule;

  /** Сохранить недельное расписание целиком. */
  @route("/schedule")
  @put
  op putSchedule(@body body: Schedule): Schedule | InvalidRequest;

  /**
   * Недельный календарь: расписание и записи одной недели.
   * Изменение расписания не отменяет существующие записи.
   */
  @route("/calendar")
  @get
  op getCalendarWeek(@query weekStart: LocalDate): CalendarWeek | InvalidRequest;

  // -------------------------------------------------------------
  // Операции: владелец — список звонков и отмена
  // -------------------------------------------------------------

  /**
   * Единый список звонков владельца с пагинацией «показать ещё».
   * Будущие сортируются по возрастанию, прошедшие — по убыванию.
   * Элементы списка содержат детали: email и комментарий посетителя.
   */
  @route("/bookings")
  @get
  op listBookings(
    @query scope: BookingScope,
    @query cursor?: string,
    @query limit?: int32,
  ): BookingPage | InvalidRequest;

  /**
   * Отмена звонка владельцем: переход «active → cancelled».
   * Отменённая запись сразу освобождает слот. Единственная операция
   * над записью; отменённую запись повторно отменить нельзя (409).
   */
  @route("/bookings/{id}/cancel")
  @post
  op cancelBooking(@path id: string): Booking | Conflict | NotFound;

  // -------------------------------------------------------------
  // Операции: владелец — управление типами звонков
  // -------------------------------------------------------------

  /** Создать новый тип звонка. */
  @route("/types")
  @post
  op createBookingType(@body body: CreateBookingTypeRequest): BookingTypeCreated | InvalidRequest | Conflict;

  /** Обновить тип звонка. */
  @route("/types/{id}")
  @put
  op updateBookingType(
    @path id: string,
    @body body: UpdateBookingTypeRequest,
  ): BookingType | InvalidRequest | Conflict | NotFound;

  /**
   * Удалить тип звонка. Существующие записи сохраняются по снимку,
   * будущие активные записи не отменяются.
   */
  @route("/types/{id}")
  @delete
  op deleteBookingType(@path id: string): NoContent | NotFound;
}